/** Shared core: helpers, markdown + Mermaid parsers, layout, diagram styles + settings.
 * Imported by index.html and 3d.html. Page-specific APIs (S, restyle, go, …) are attached via bindPage().
 */
'use strict';

/** @type {(s: string) => any} */
export const $=s=>document.querySelector(s);

/**
 * Page-specific API (filled by each page after its render/player code exists).
 * @type {{
 *   S: any,
 *   restyle: () => void,
 *   go: (i: number, fromPlay?: boolean) => void,
 *   toast: (m: string) => void,
 *   drawer: (o: boolean) => void,
 *   showErr: (m: string) => void,
 *   tryRender: () => void,
 *   encode: (str: string) => Promise<string>,
 * }}
 */
export let page = /** @type {any} */ ({});

/** @param {typeof page} p */
export function bindPage(p){ page = p; }

/* ---------- shared core: helpers, markdown + Mermaid parsers, layout, diagram styles + settings ---------- */
/** @typedef {{id:string,label:string,shape:string,group:number|null,gx?:number,gy?:number,note?:string,icon?:string,iconFallback?:string,ci?:number,hk?:number,actor?:boolean,special?:string,kind?:string,members?:{f:string[],a:string[]},attrs?:string[],junction?:boolean,rank?:number,color?:string}} FxNode */
/** @typedef {FxNode & {gx:number,gy:number}} PlacedNode */
/** @typedef {{u:number,v:number,fw:boolean,bw:boolean,flip:boolean,a:number,b:number,chain:LayoutItem[],pts:number[][]}} Route */
/** @typedef {{real:boolean,i?:number,r:number,up:LayoutItem[],down:LayoutItem[],y:number,p?:number,bc?:number}} LayoutItem */
/** @typedef {{from:string,to:string,label:string,dotted:boolean,arrow:boolean,pts?:number[][]|null,route?:Route|null,an?:string,bn?:string}} FxLink */
/** @typedef {{title:string,icon?:string}} Group */
/** @typedef {{type:string,nodes:FxNode[],links:FxLink[],steps:Step[],groups:Group[],fixed?:boolean,noZones?:boolean,diagramTitle?:string,title?:string,intro?:string}} Graph */
/** @typedef {{title:string,intro:string,code:string,ordered:string[],named:Array<[string,string]>}} Scene */
/** @typedef {{docTitle:string,scenes:Scene[]}} MdDoc */
/** @param {unknown} s */
export const esc=s=>String(s).replace(/[&<>"]/g,c=>/** @type {Record<string,string>} */({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
/** @param {string} s */
export const mdInline=s=>esc(s).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/`([^`]+)`/g,'<code>$1</code>');

/* ---------- markdown ---------- */
/** @param {string} md @returns {MdDoc} */
export function parseMarkdown(md){
  const lines=md.replace(/\r/g,'').split('\n');
  let docTitle='',heading='',para=/** @type {string[]} */([]),cur=/** @type {Scene|null} */(null);const scenes=/** @type {Scene[]} */([]);
  for(let i=0;i<lines.length;i++){
    const l=lines[i];/** @type {RegExpMatchArray|null} */let m;
    if(m=l.match(/^\s*(```+|~~~+)\s*mermaid\s*$/i)){
      /** @type {string[]} */ const code=[];i++;
      while(i<lines.length&&!lines[i].trim().startsWith(m[1].slice(0,3))){code.push(lines[i]);i++}
      cur=/** @type {Scene} */({title:heading||docTitle,intro:para.join(' '),code:code.join('\n'),ordered:[],named:[]});
      scenes.push(cur);para=[];
    }else if(m=l.match(/^(#{1,6})\s+(.*?)\s*#*$/)){
      if(m[1].length===1&&!docTitle)docTitle=m[2];
      heading=m[2];para=[];
    }else if(cur&&(m=l.match(/^\s*\d+[.)]\s+(.*)/)))cur.ordered.push(m[1]);
    else if(cur&&(m=l.match(/^\s*[-*+]\s+(.*)/))){
      const k=m[1].match(/^(.+?)[:：]\**\s+(.+)$/);
      if(k)cur.named.push([k[1].replace(/[*`]/g,'').trim(),k[2].replace(/^\*+\s*/,'')]);
    }else if(l.trim()&&!cur)para.push(l.trim());
    else if(l.trim()&&cur&&!/^\s*([-*+]|\d+[.)])\s/.test(l)&&!/^\s*</.test(l)){/* trailing prose ignored */}
  }
  if(!scenes.length&&/^\s*(%%.*\n\s*)*(flowchart|graph|sequenceDiagram|stateDiagram|classDiagram|erDiagram|gantt|pie|mindmap|journey|timeline|quadrantChart|gitGraph|xychart(-beta)?|sankey(-beta)?|block(-beta)?|architecture(-beta)?|C4Context|C4Container|C4Component|C4Dynamic|C4Deployment|kanban|packet(-beta)?|requirementDiagram)\b/.test(md))
    scenes.push({title:'',intro:'',code:md,ordered:[],named:[]});
  return {docTitle,scenes};
}

/* ---------- mermaid: shared ---------- */
/** @param {string|null|undefined} t @returns {string} */
export function cleanText(t){
  t=(t||'').trim();
  if(/^".*"$/.test(t)||/^'.*'$/.test(t))t=t.slice(1,-1);
  if(/^`.*`$/.test(t))t=t.slice(1,-1);
  return t.replace(/<br\s*\/?>/gi,' ').replace(/<[^>]+>/g,'').replace(/#quot;/g,'"').replace(/#(\d+);/g,(_,/** @type {string} */n)=>String.fromCharCode(+n))
    .replace(/\bfa[bsrl]?:fa-[\w-]+\s*/g,'').replace(/\*\*|__/g,'').replace(/\\n/g,' ').replace(/\s+/g,' ').trim();
}
/** @param {string} code */
export function codeLines(code){
  let ls=code.split('\n').map(l=>l.replace(/%%.*$/,'').trim().replace(/;$/,''));
  if(ls.find(l=>l)==='---'){const a=ls.indexOf('---'),b=ls.indexOf('---',a+1);if(b>a)ls=ls.slice(b+1)}
  return ls.filter(l=>l);
}
/** @param {string} code @returns {Graph} */
export function parseMermaid(code){

  const ls=codeLines(code);
  if(!ls.length)throw new Error('The mermaid block is empty.');
  if(/^(flowchart|graph)\b/i.test(ls[0]))return parseFlow(ls.slice(1));
  if(/^sequenceDiagram\b/i.test(ls[0]))return parseSeq(ls.slice(1));
  if(/^stateDiagram(-v2)?\b/i.test(ls[0]))return parseState(ls.slice(1));
  if(/^classDiagram(-v2)?\b/i.test(ls[0]))return parseClass(ls.slice(1));
  if(/^erDiagram\b/i.test(ls[0]))return parseER(ls.slice(1));
  if(/^gantt\b/i.test(ls[0]))return parseGantt(ls.slice(1));
  if(/^pie\b/i.test(ls[0]))return parsePie(ls[0],ls.slice(1));
  if(/^mindmap\b/i.test(ls[0]))return parseMindmap(code);
  if(/^journey\b/i.test(ls[0]))return parseJourney(ls.slice(1));
  if(/^timeline\b/i.test(ls[0]))return parseTimeline(ls.slice(1));
  if(/^quadrantChart\b/i.test(ls[0]))return parseQuadrant(ls.slice(1));
  if(/^gitGraph\b/i.test(ls[0]))return parseGit(ls.slice(1));
  if(/^xychart(-beta)?\b/i.test(ls[0]))return parseXY(ls.slice(1));
  if(/^sankey(-beta)?\b/i.test(ls[0]))return parseSankey(ls.slice(1));
  if(/^block(-beta)?\s*$/i.test(ls[0]))return parseBlock(ls.slice(1));
  if(/^architecture(-beta)?\b/i.test(ls[0]))return parseArch(ls.slice(1));
  if(/^C4(Context|Container|Component|Dynamic|Deployment)\b/.test(ls[0]))return parseC4(ls[0],ls.slice(1));
  if(/^kanban\b/i.test(ls[0]))return parseKanban(code);
  if(/^packet(-beta)?\b/i.test(ls[0]))return parsePacket(ls.slice(1));
  if(/^requirementDiagram\b/i.test(ls[0]))return parseReq(ls.slice(1));
  if(/^radar(-beta)?\b/i.test(ls[0]))return parseRadar(ls.slice(1));
  if(/^treemap(-beta)?\b/i.test(ls[0]))return parseTreemap(code);
  if(/^zenuml\b/i.test(ls[0]))return parseZen(ls.slice(1));
  throw new Error('“'+ls[0].split(/\s/)[0]+'” diagrams are not supported yet. This version reads flowchart, sequenceDiagram, stateDiagram, classDiagram, erDiagram, gantt, pie, mindmap, journey, timeline, quadrantChart, gitGraph, xychart, sankey, block, architecture, C4, kanban, packet, requirementDiagram, radar, treemap and zenuml.');
}

/* ---------- mermaid: flowchart ---------- */
export const ID_RE=/^[\wÀ-￿]+(?:[-.][\wÀ-￿]+)*/;
/** @type {Array<[string,string|null,string]>} */
export const SHAPES=[['(((',')))','circle'],['([','])','pill'],['[[',']]','box'],['[(',')]','cyl'],['((','))','circle'],['{{','}}','hex'],['[/',null,'box'],['[\\',null,'box'],['[',']','box'],['(',')','pill'],['{','}','hex'],['>',']','box']];
/** @type {Record<string,string>} */
export const SHAPE_ALIAS={cyl:'cyl',cylinder:'cyl',database:'cyl',db:'cyl',diamond:'hex',diam:'hex',decision:'hex',hex:'hex',hexagon:'hex',circle:'circle',circ:'circle','sm-circ':'circle',stadium:'pill',pill:'pill',rounded:'pill',terminal:'pill'};
/** @param {string[]} ls @returns {Graph} */
export function parseFlow(ls){
  const nodes=/** @type {Map<string,FxNode>} */(new Map()),links=/** @type {FxLink[]} */([]),groups=/** @type {Group[]} */([]),stack=/** @type {number[]} */([]);
  /** @param {string} id @returns {FxNode} */
  const getNode=id=>{
    if(!nodes.has(id))nodes.set(id,{id,label:id,shape:'box',group:null});
    const n=/** @type {FxNode} */(nodes.get(id));if(n.group==null&&stack.length)n.group=stack[stack.length-1];return n;
  };
  for(const line of ls){
    /** @type {RegExpMatchArray|null} */ let m;
    if(/^(classDef|class|style|linkStyle|click|direction|accTitle|accDescr)\b/.test(line))continue;
    if(m=line.match(/^subgraph\s+(.*)$/)){
      const rest=m[1].trim();const t=rest.match(/^[\w-]+\s*\[(.+)\]$/);
      groups.push({title:cleanText(t?t[1]:rest)});stack.push(groups.length-1);continue;
    }
    if(line==='end'){stack.pop();continue}
    statement(line);
  }
  /** @param {string} s */
  function statement(s){
    let pos=0;
    const ws=()=>{while(s[pos]===' '||s[pos]==='\t')pos++};
    const nodeRef=()=>{
      ws();const m=s.slice(pos).match(ID_RE);if(!m)return null;
      pos+=m[0].length;const n=getNode(m[0]);const rest=s.slice(pos);
      if(rest.startsWith('@{')){
        const e=rest.indexOf('}');
        if(e>0){const body=rest.slice(2,e);const lm=body.match(/label:\s*(?:"([^"]*)"|([^,]+))/);const sm=body.match(/shape:\s*([\w-]+)/);
          if(lm)n.label=cleanText(lm[1]??lm[2]);if(sm)n.shape=SHAPE_ALIAS[sm[1]]||'box';pos+=e+1}
      }else for(const [o,c,shape] of SHAPES){
        if(!rest.startsWith(o))continue;
        let i=o.length,found=-1,clen=0;
        for(;i<rest.length;i++){
          if(rest[i]==='"'){const q=rest.indexOf('"',i+1);if(q<0)break;i=q;continue}
          if(c?rest.startsWith(c,i):(rest.startsWith('/]',i)||rest.startsWith('\\]',i))){found=i;clen=c?c.length:2;break}
        }
        if(found>=0){n.label=cleanText(rest.slice(o.length,found))||n.id;n.shape=shape;pos+=found+clen}
        break;
      }
      const cm=s.slice(pos).match(/^:::[\w-]+/);if(cm)pos+=cm[0].length;
      return n;
    };
    const nodeGroup=()=>{
      let n=nodeRef();if(!n)return null;const arr=[n];
      for(;;){ws();if(s[pos]!=='&')break;pos++;n=nodeRef();if(!n)break;arr.push(n)}
      return arr;
    };
    const edgeTok=()=>{
      ws();const r=s.slice(pos);let label='',tok;/** @type {RegExpMatchArray|null} */let m;

      if(m=r.match(/^<?(-{2,}>|-{3,}|-{2,}[ox](?=\s)|={2,}>|={3,}|-\.+->?|~{3,})/)){tok=m[0];pos+=m[0].length}
      else if(m=r.match(/^<?(--|==|-\.)(?![-=>.])\s*(.+?)\s*(\.+-+>?|={2,}>?|-{2,}>?)(?=\s|$|[\w("'[])/)){tok=m[1]+m[3];label=m[2];pos+=m[0].length}
      else return null;
      ws();const lm=s.slice(pos).match(/^\|([^|]*)\|/);if(lm){label=lm[1];pos+=lm[0].length}
      return {label:cleanText(label),dotted:tok.includes('.'),arrow:tok.endsWith('>')};
    };
    let left=nodeGroup();if(!left)return;
    for(;;){
      const e=edgeTok();if(!e)break;const right=nodeGroup();if(!right)break;
      for(const a of left)for(const b of right)links.push({from:a.id,to:b.id,label:e.label,dotted:e.dotted,arrow:e.arrow});
      left=right;
    }
  }
  const N=[...nodes.values()];if(!N.length)throw new Error('No boxes found in the flowchart.');
  const by=(/** @type {string} */id)=>/** @type {FxNode} */(nodes.get(id));
  /** @type {Step[]} */
  const steps=links.map((l,i)=>{

    const a=by(l.from),b=by(l.to);
    if(a===b)return {kind:'node',nodes:[a.id],title:a.label,auto:l.label||('**'+a.label+'** repeats.')};
    let auto;
    if(l.label)auto=a.shape==='hex'?'If the answer is **'+l.label+'**, continue to **'+b.label+'**.':'**'+a.label+'** → **'+b.label+'**: '+l.label+'.';
    else auto='**'+a.label+'** hands over to **'+b.label+'**.';
    return {kind:'edge',link:i,reverse:false,from:a.id,to:b.id,nodes:[a.id,b.id],title:a.label+' → '+b.label,chip:l.label,auto};
  });
  return {type:'flow',nodes:N,links,steps,groups};
}

/* ---------- mermaid: sequence ---------- */
/** @param {string[]} ls @returns {Graph} */
export function parseSeq(ls){
  const nodes=/** @type {Map<string,FxNode>} */(new Map()),links=/** @type {FxLink[]} */([]),lmap=/** @type {Map<string,number>} */(new Map()),steps=/** @type {Step[]} */([]),ctx=/** @type {Array<{text:string|null}>} */([]);
  /** @type {Record<string,string>} */
  const WORD={alt:'When',else:'Otherwise',opt:'Optional',loop:'Repeat',par:'In parallel',and:'In parallel',critical:'Critical',break:'Stop if',option:'Otherwise'};
  /** @param {string} id @param {string} [label] @param {boolean} [actor] @returns {FxNode} */
  const getNode=(id,label,actor)=>{
    id=id.trim();
    if(!nodes.has(id)){const lb=cleanText(label||id);nodes.set(id,{id,label:lb,shape:actor?'pill':(/\b(db|database|sql|mysql|postgres|redis|cache|storage|store|s3)\b|資料庫/i.test(lb)?'cyl':'box'),group:null,actor:!!actor})}
    return /** @type {FxNode} */(nodes.get(id));
  };

  const tag=()=>{for(let i=ctx.length-1;i>=0;i--)if(ctx[i].text!=null)return /** @type {string} */(ctx[i].text);return ''};
  for(const line of ls){
    let m;
    if(m=line.match(/^(?:create\s+)?(participant|actor)\s+(.+?)(?:\s+as\s+(.+))?$/i)){getNode(m[2],m[3],/actor/i.test(m[1]));continue}
    if(m=line.match(/^(alt|opt|loop|par|critical|break|rect|box)\b\s*(.*)$/i)){
      const k=m[1].toLowerCase();ctx.push({text:(k==='rect'||k==='box')?null:(WORD[k]+(m[2]?': '+cleanText(m[2]):''))});continue}
    if(m=line.match(/^(else|and|option)\b\s*(.*)$/i)){if(ctx.length)ctx[ctx.length-1].text=WORD[m[1].toLowerCase()]+(m[2]?': '+cleanText(m[2]):'');continue}
    if(/^end$/i.test(line)){ctx.pop();continue}
    if(m=line.match(/^note\s+(?:over|left of|right of)\s+([^:]+):\s*(.*)$/i)){
      const ids=m[1].split(',').map(s=>getNode(s).id);
      steps.push({kind:'node',nodes:ids,title:'Note',auto:cleanText(m[2]),tag:tag()});continue}
    if(m=line.match(/^(.+?)\s*(<<-->>|<<->>|-->>|->>|--x|-x|--\)|-\)|-->|->)\s*[+-]?\s*(.+?)\s*:\s*(.*)$/)){
      const a=getNode(m[1]),b=getNode(m[3]),text=cleanText(m[4]),dotted=m[2].startsWith('--')||m[2].startsWith('<<--');
      if(a===b){steps.push({kind:'node',nodes:[a.id],title:text||a.label,auto:'**'+a.label+'** does this on its own.',tag:tag()});continue}
      const key=[a.id,b.id].sort().join('\u0001');let li=lmap.get(key);
      if(li==null){li=links.length;lmap.set(key,li);links.push({from:a.id,to:b.id,label:'',dotted:false,arrow:false})}
      steps.push({kind:'edge',link:li,reverse:links[li].from!==a.id,from:a.id,to:b.id,nodes:[a.id,b.id],title:text||(a.label+' → '+b.label),
        auto:'**'+a.label+'** '+(dotted?'replies to':'sends this to')+' **'+b.label+'**.',tag:tag()});
    }
  }
  const N=[...nodes.values()];if(!N.length)throw new Error('No participants found in the sequence diagram.');
  return {type:'seq',nodes:N,links,steps,groups:[]};
}

/* ---------- mermaid: shared helpers for the other diagram types ---------- */
/** @typedef {{kind:string,nodes:string[],title:string,auto:string,tag?:string,chip?:string,link?:number,reverse?:boolean,from?:string,to?:string,text?:string,custom?:boolean}} Step */
/** @typedef {{label?:string,dotted?:boolean,arrow?:boolean}} LinkOpts */
/** @typedef {{auto:string,title?:string,chip?:string,tag?:string}} StepOpts */
/** @param {string} s */
export const ucWords=s=>/[a-z]/.test(s)||!/[A-Z]/.test(s)?s:s.toLowerCase().replace(/[_-]+/g,' ').replace(/^\w/,c=>c.toUpperCase());
export function graphKit(){
  const nodes=/** @type {Map<string,FxNode>} */(new Map()),links=/** @type {FxLink[]} */([]),groups=/** @type {Group[]} */([]),stack=/** @type {number[]} */([]);
  /** @param {string} id @param {string|null} [label] @param {string} [shape] @returns {FxNode} */
  const node=(id,label,shape)=>{
    if(!nodes.has(id))nodes.set(id,{id,label:label||id,shape:shape||'box',group:stack.length?stack[stack.length-1]:null});
    return /** @type {FxNode} */(nodes.get(id));
  };
  /** @param {FxNode} a @param {FxNode} b @param {LinkOpts} [o] */
  const link=(a,b,o={})=>{links.push({from:a.id,to:b.id,label:o.label||'',dotted:!!o.dotted,arrow:!!o.arrow});return links.length-1};
  /** @param {number} li @param {StepOpts} o @returns {Step} */
  const edgeStep=(li,o)=>{const l=links[li],a=/** @type {FxNode} */(nodes.get(l.from)),b=/** @type {FxNode} */(nodes.get(l.to));
    return {kind:'edge',link:li,reverse:false,from:a.id,to:b.id,nodes:[a.id,b.id],title:o.title||(a.label+' → '+b.label),chip:o.chip||'',auto:o.auto,tag:o.tag||''}};
  /** @param {FxNode} n @param {StepOpts} o @returns {Step} */
  const nodeStep=(n,o)=>({kind:'node',nodes:[n.id],title:o.title||n.label,auto:o.auto,tag:o.tag||''});
  /** @param {FxNode} n @param {string} t */
  const addNote=(n,t)=>{
t=cleanText(t);if(t)n.note=n.note?n.note+' '+t:t};
  return {nodes,links,groups,stack,node,link,edgeStep,nodeStep,addNote};
}

/* ---------- mermaid: state ---------- */
/** @param {string[]} ls @returns {Graph} */
export function parseState(ls){
  const K=graphKit(),steps=/** @type {Step[]} */([]),comp=/** @type {string[]} */([]),trs=/** @type {Array<{li:number,label:string,tag:string}>} */([]);
  const B=(/** @type {string} */s)=>'**'+s+'**';
  /** @param {string} raw */
  const ref=raw=>{
    raw=raw.trim().replace(/:::[\w-]+$/,'');
    if(raw==='[*]')return null;
    return K.node(raw,raw);
  };
  const ends=/** @type {Map<string,FxNode>} */(new Map());
  /** @param {string} kind @returns {FxNode} */
  const special=(kind)=>{
    const g=K.stack.length?K.stack[K.stack.length-1]:'root',key=kind+'_'+g;
    if(!ends.has(key)){const inner=g!=='root';const n=K.node('__'+key,kind==='start'?(inner?'Start ('+K.groups[g].title+')':'Start'):(inner?'Done ('+K.groups[g].title+')':'End'),'circle');n.special=kind;n.icon=kind==='start'?'🟢':'🏁';ends.set(key,n)}
    return /** @type {FxNode} */(ends.get(key));
  };
  for(let i=0;i<ls.length;i++){
    const line=ls[i];/** @type {RegExpMatchArray|null} */let m;
    if(/^(classDef|class|style|direction|accTitle|accDescr|hide|scale)\b/.test(line)||line==='--'||line==='||')continue;
    if(m=line.match(/^note\s+(?:left|right)\s+of\s+([^:]+?)\s*:\s*(.+)$/i)){K.addNote(K.node(m[1].trim()),m[2]);continue}
    if(m=line.match(/^note\s+(?:left|right)\s+of\s+(.+)$/i)){const n=K.node(m[1].trim()),t=[];i++;while(i<ls.length&&!/^end\s*note$/i.test(ls[i])){t.push(ls[i]);i++}K.addNote(n,t.join(' '));continue}
    if(m=line.match(/^state\s+"([^"]+)"\s+as\s+([\w-]+)\s*(\{)?$/)){const n=K.node(m[2]);n.label=cleanText(m[1]);if(m[3]){K.groups.push({title:n.label});K.stack.push(K.groups.length-1);comp.push(m[2])}continue}
    if(m=line.match(/^state\s+([\w-]+)\s*<<(choice|fork|join)>>$/i)){const n=K.node(m[1]);n.shape=m[2].toLowerCase()==='choice'?'hex':'pill';n.label=m[2].toLowerCase()==='choice'?'Check':(m[2].toLowerCase()==='fork'?'Split':'Join');continue}
    if(m=line.match(/^state\s+([\w-]+)\s*\{$/)){K.groups.push({title:cleanText(m[1])});K.stack.push(K.groups.length-1);comp.push(m[1]);continue}
    if(m=line.match(/^state\s+([\w-]+)$/)){K.node(m[1]);continue}
    if(line==='}'){K.stack.pop();comp.pop();continue}
    if(m=line.match(/^(\[\*\]|[\w-]+(?::::[\w-]+)?)\s*-->\s*(\[\*\]|[\w-]+(?::::[\w-]+)?)\s*(?::\s*(.*))?$/)){
      const a=ref(m[1])||special('start'),b=ref(m[2])||special('end'),label=cleanText(m[3]||'');
      trs.push({li:K.link(a,b,{label,arrow:true}),label,tag:K.stack.length?K.groups[K.stack[K.stack.length-1]].title:''});
      continue;
    }
    if(m=line.match(/^([\w-]+)\s*:\s*(.+)$/)){K.addNote(K.node(m[1]),m[2]);continue}
    if(m=line.match(/^([\w-]+)$/)){K.node(m[1]);continue}
  }
  const N=[...K.nodes.values()];if(!N.length)throw new Error('No states found in the state diagram.');
  N.forEach(n=>{if(!n.special&&n.label===n.id)n.label=ucWords(n.label)});
  for(const {li,label,tag} of trs){
    const l=K.links[li],a=/** @type {FxNode} */(K.nodes.get(l.from)),b=/** @type {FxNode} */(K.nodes.get(l.to));let auto;
    if(a.special==='start')
auto=tag?'Inside '+B(tag)+', it starts in '+B(b.label)+'.':'It all starts in '+B(b.label)+'.';
    else if(b.special==='end')auto=B(a.label)+' is where it finishes'+(label?' — when '+label:'')+'.';
    else if(a.shape==='hex')auto=label?'If '+label+', it goes to '+B(b.label)+'.':'The check sends it to '+B(b.label)+'.';
    else auto=label?'When '+B(label)+' happens, '+B(a.label)+' changes to '+B(b.label)+'.':B(a.label)+' moves on to '+B(b.label)+'.';
    steps.push(K.edgeStep(li,{auto,chip:label,tag,title:a.special?'Start → '+b.label:b.special?a.label+' → End':a.label+' → '+b.label}));
  }
  return {type:'state',nodes:N,links:K.links,steps,groups:K.groups};
}

/* ---------- mermaid: class ---------- */
/** @type {Array<[string,string,number,number,string?]>} */
export const CLASS_REL=[
  ['<|--','is a kind of',1,0],['--|>','is a kind of',0,0],['<|..','is a way of doing',1,1],['..|>','is a way of doing',0,1],
  ['*--','is made up of',0,0,'contains'],['--*','is part of',0,0],['o--','has',0,0],['--o','belongs to',0,0],
  ['<-->','works with',0,0],['-->','uses',0,0],['<--','uses',1,0],['..>','depends on',0,1],['<..','depends on',1,1],['--','is linked to',0,0],['..','is loosely linked to',0,1]
];
/** @param {string[]} ls @returns {Graph} */
export function parseClass(ls){
  const K=graphKit(),steps=/** @type {Step[]} */([]),rels=/** @type {RegExpMatchArray[]} */([]);
  /** @param {string} raw */
  const cls=raw=>{
    let id=raw.trim().replace(/:::[\w-]+$/,''),label=/** @type {string|null} */(null);/** @type {RegExpMatchArray|null} */let m;
    if(m=id.match(/^([\w.-]+)\s*\["?([^"\]]*)"?\]$/)){id=m[1];label=cleanText(m[2])}
    if(m=id.match(/^`(.+)`$/))id=m[1];
    const base=id.replace(/~[^~]*~/g,''),n=K.node(base,base);
    if(label)n.label=label;
    const g=id.match(/~([^~]+)~/);if(g&&n.label===base)n.label=base+'<'+g[1]+'>';
    n.iconFallback='🧩';
    return n;
  };
  /** @param {FxNode} n @param {string} t */
  const member=(n,t)=>{t=t.trim();if(!t)return;/** @type {RegExpMatchArray|null} */let m;
    if(m=t.match(/^<<(.+)>>$/)){n.kind=cleanText(m[1]);return}
    t=t.replace(/[$*]$/,'').replace(/^[+\-#~]/,'').trim();
    (n.members=n.members||{f:[],a:[]})[/\(/.test(t)?'a':'f'].push(t.replace(/\s+/g,' '));
  };
  const relRe=new RegExp('^(\\S+?)\\s*(?:"([^"]*)"\\s*)?('+CLASS_REL.map(r=>String(r[0]).replace(/[|*.]/g,'\\$&')).join('|')+')\\s*(?:"([^"]*)"\\s*)?(\\S+?)\\s*(?::\\s*(.*))?$');
  for(let i=0;i<ls.length;i++){
    const line=ls[i];let m;
    if(/^(classDef|cssClass|style|direction|accTitle|accDescr|click|callback|link)\b/.test(line))continue;
    if(m=line.match(/^namespace\s+([\w.-]+)\s*\{$/)){K.groups.push({title:m[1]});K.stack.push(K.groups.length-1);continue}
    if(m=line.match(/^class\s+(.+?)\s*\{\s*(.*?)\s*(\})?$/)){const n=cls(m[1]);if(m[2])member(n,m[2]);if(!m[3]){i++;while(i<ls.length&&ls[i]!=='}'){member(n,ls[i]);i++}}continue}
    if(m=line.match(/^class\s+(.+)$/)){cls(m[1]);continue}
    if(line==='}'){K.stack.pop();continue}
    if(m=line.match(/^<<(.+)>>\s+([\w.-]+)$/)){cls(m[2]).kind=cleanText(m[1]);continue}
    if(m=line.match(/^note\s+for\s+([\w.-]+)\s+"(.*)"$/)){K.addNote(cls(m[1]),m[2].replace(/\\n/g,' '));continue}
    if(/^note\s/.test(line))continue;
    if(m=line.match(relRe)){rels.push(m);continue}
    if(m=line.match(/^([\w.-]+)\s*:\s*(.+)$/)){member(cls(m[1]),m[2]);continue}
  }
  /** @param {string|undefined} s */
  const card=s=>{s=(s||'').trim();return /** @type {Record<string,string>} */({'1':'one','0..1':'zero or one','1..*':'one or more','*':'many','n':'many','0..n':'zero or more','0..*':'zero or more','1..n':'one or more','many':'many'})[s]||s};
  for(const m of rels){
    const r=/** @type {[string,string,number,number,string?]} */(CLASS_REL.find(x=>x[0]===m[3]));const a=cls(m[1]),b=cls(m[5]);

    const label=cleanText(m[6]||'');
    const li=K.link(a,b,{label,dotted:!!r[3],arrow:/>|\|>/.test(m[3])&&!/^</.test(m[3])});
    const [s,o]=r[2]?[b,a]:[a,b],B=(/** @type {FxNode} */x)=>'**'+x.label+'**';
    let auto=label?B(s)+' '+label+' '+B(o)+' ('+(r[4]||r[1])+').':B(s)+' '+r[1]+' '+B(o)+'.';
    if(r[1]==='is a kind of')auto=B(s)+' is a kind of '+B(o)+', so it gets everything '+o.label+' has.'+(label?' ('+label+')':'');
    if(r[1]==='is a way of doing')auto=B(s)+' follows the rules set by '+B(o)+'.'+(label?' ('+label+')':'');
    const c1=card(m[2]),c2=card(m[4]),chip=(c1||c2)?(c1||'?')+' → '+(c2||'?'):label;
    if(c1||c2)auto+=' '+(c1?'One side: '+c1+' '+a.label+'.':'')+(c2?' Other side: '+c2+' '+b.label+'.':'');
    steps.push(K.edgeStep(li,{auto:auto.trim(),chip}));
  }
  const N=[...K.nodes.values()];if(!N.length)throw new Error('No classes found in the class diagram.');
  N.forEach(n=>{
    const p=[];if(n.kind)p.push('Type: '+n.kind+'.');
    if(n.members){if(n.members.f.length)p.push('Holds: '+n.members.f.join(', ')+'.');if(n.members.a.length)p.push('Can do: '+n.members.a.join(', ')+'.')}
    if(p.length)n.note=p.join(' ')+(n.note?' '+n.note:'');
  });
  if(!steps.length)N.forEach(n=>steps.push(K.nodeStep(n,{auto:n.note||('This is **'+n.label+'**.')})));
  return {type:'class',nodes:N,links:K.links,steps,groups:K.groups};
}

/* ---------- mermaid: ER ---------- */
/** @type {Record<string,string>} */
export const ER_CARD={'||':'exactly one','|o':'zero or one','o|':'zero or one','}|':'one or more','|{':'one or more','}o':'zero or more','o{':'zero or more'};
/** @param {string[]} ls @returns {Graph} */
export function parseER(ls){
  const K=graphKit(),steps=/** @type {Step[]} */([]);
  /** @param {string} raw */
  const ent=raw=>{
    raw=raw.trim();/** @type {RegExpMatchArray|null} */let m;let id=raw,label=/** @type {string|null} */(null);
    if(m=raw.match(/^([\w-]+)\s*\[\s*"?([^"\]]*)"?\s*\]$/)){id=m[1];label=m[2]}
    else if(m=raw.match(/^"(.+)"$/))id=m[1];
    const n=K.node(id,label?cleanText(label):ucWords(id));n.iconFallback='📋';return n;
  };
  /** @param {FxNode} n @param {string} t */
  const attr=(n,t)=>{const m=t.trim().match(/^(\S+)\s+(\S+)((?:\s+(?:PK|FK|UK)\s*,?)*)\s*(?:"(.*)")?$/);if(!m)return;
    const keys=m[3]||'',extra=/PK/.test(keys)?' (ID)':/FK/.test(keys)?' (link)':'';(n.attrs=n.attrs||[]).push(m[2].replace(/_/g,' ')+extra+(m[4]?' — '+m[4]:''))};
  for(let i=0;i<ls.length;i++){
    const line=ls[i];let m;
    if(/^(classDef|class|style|direction|accTitle|accDescr)\b/.test(line))continue;
    if(m=line.match(/^(.+?)\s*(\|o|\|\||\}o|\}\|)(--|\.\.)(o\||\|\||o\{|\|\{)\s*(.+?)\s*:\s*(.+)$/)){
      const a=ent(m[1]),b=ent(m[5]),label=cleanText(m[6]),cl=ER_CARD[m[2]],cr=ER_CARD[m[4]];
      const li=K.link(a,b,{label,dotted:m[3]==='..'});
      const one=(/** @type {FxNode} */x)=>x.label.toLowerCase();

      steps.push(K.edgeStep(li,{chip:label,auto:'Each **'+a.label+'** '+label+' **'+cr+'** '+one(b)+'. Each '+one(b)+' is linked to **'+cl+'** '+one(a)+'.'}));
      continue;
    }
    if(m=line.match(/^(.+?)\s*\{\s*(.*?)\s*(\})?$/)){const n=ent(m[1]);if(m[2])attr(n,m[2]);if(!m[3]){i++;while(i<ls.length&&ls[i]!=='}'){attr(n,ls[i]);i++}}continue}
    if(m=line.match(/^("[^"]+"|[\w-]+(?:\s*\[[^\]]*\])?)$/))ent(m[1]);
  }
  const N=[...K.nodes.values()];if(!N.length)throw new Error('No tables found in the ER diagram.');
  N.forEach(n=>{if(n.attrs)n.note='Stores: '+n.attrs.join(', ')+'.'});
  if(!steps.length)N.forEach(n=>steps.push(K.nodeStep(n,{auto:n.note||('This is **'+n.label+'**.')})));
  return {type:'er',nodes:N,links:K.links,steps,groups:[]};
}

/* ---------- mermaid: gantt ---------- */
/** @typedef {{label:string,id:string,start:string|null,end:string|null,tags:string[],section:number|null,deps:GanttTask[],s:number|null,e:number|null,d:number|null,soft?:boolean,n:FxNode}} GanttTask */
/** @param {string[]} ls @returns {Graph} */
export function parseGantt(ls){
  const K=graphKit(),tasks=/** @type {GanttTask[]} */([]);let title='',fmt='YYYY-MM-DD',section=/** @type {number|null} */(null);
  const DAY=864e5,UNIT=/** @type {Record<string,number>} */({ms:1,s:1e3,m:6e4,h:36e5,d:DAY,w:7*DAY,M:30*DAY,y:365*DAY});
  /** @param {string} s @returns {number|null} */
  const parseDate=s=>{s=s.trim();/** @type {RegExpMatchArray|null} */let m;
    if(/^YYYY-MM-DD/.test(fmt)&&(m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?$/)))return Date.UTC(+m[1],+m[2]-1,+m[3],+(m[4]||0),+(m[5]||0));
    if(/^DD[-/.]MM[-/.]YYYY/.test(fmt)&&(m=s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/)))return Date.UTC(+m[3],+m[2]-1,+m[1]);
    if(/^MM[-/.]DD[-/.]YYYY/.test(fmt)&&(m=s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/)))return Date.UTC(+m[3],+m[1]-1,+m[2]);
    if(/^\d{4}-\d{2}-\d{2}/.test(s)){const t=Date.parse(s);if(!isNaN(t))return t}
    return null};
  /** @param {string} s */
  const dur=s=>{const m=s.trim().match(/^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d|w|M|y)$/);return m?+m[1]*UNIT[m[2]]:null};
  for(const line of ls){
    let m;
    if(m=line.match(/^title\s+(.+)$/)){title=cleanText(m[1]);continue}
    if(m=line.match(/^dateFormat\s+(.+)$/)){fmt=m[1].trim();continue}
    if(/^(axisFormat|tickInterval|excludes|includes|todayMarker|weekday|inclusiveEndDates|topAxis|displayMode|accTitle|accDescr|click)\b/.test(line))continue;
    if(m=line.match(/^section\s+(.+)$/)){K.groups.push({title:cleanText(m[1])});section=K.groups.length-1;continue}
    if(m=line.match(/^(.+?)\s*:\s*(.*)$/)){
      const parts=m[2].split(',').map(s=>s.trim()).filter(Boolean),tags=/** @type {string[]} */([]);
      while(parts.length&&/^(done|active|crit|milestone|vert)$/.test(parts[0]))tags.push(/** @type {string} */(parts.shift()));
      let id=/** @type {string|null} */(null),start=/** @type {string|null} */(null),end=/** @type {string|null} */(null);
      if(parts.length>=3)[id,start,end]=parts;
      else if(parts.length===2){if(parseDate(parts[0])!=null||/^after\s/.test(parts[0]))[start,end]=parts;else[id,end]=parts}
      else if(parts.length===1)end=parts[0];
      tasks.push(/** @type {GanttTask} */({label:cleanText(m[1]),id:id||('task'+(tasks.length+1)),start,end,tags,section}));
    }
  }
  if(!tasks.length)throw new Error('No tasks found in the gantt chart.');
  const byId=/** @type {Map<string,GanttTask>} */(new Map());tasks.forEach(t=>byId.set(t.id,t));
  let prev=/** @type {GanttTask|null} */(null);
  tasks.forEach(t=>{
    t.deps=[];
    if(t.start&&/^after\s/.test(t.start)){t.deps=/** @type {GanttTask[]} */(t.start.replace(/^after\s+/,'').split(/\s+/).map(x=>byId.get(x)).filter(Boolean));t.s=t.deps.length&&t.deps.every(d=>d.e!=null)?Math.max(...t.deps.map(d=>/** @type {number} */(d.e))):null}
    else if(t.start){t.s=parseDate(t.start)}
    else{if(prev)t.deps=[prev];t.s=prev?prev.e:null}
    const d=t.end?dur(t.end):null,ed=t.end?parseDate(t.end):null,un=t.end&&t.end.match(/^until\s+(\S+)/);
    if(t.tags.includes('milestone'))t.e=t.s;
    else if(d!=null&&t.s!=null)t.e=t.s+d;
    else if(ed!=null)t.e=ed;
    else if(un&&byId.get(un[1])&&/** @type {GanttTask} */(byId.get(un[1])).s!=null)t.e=/** @type {GanttTask} */(byId.get(un[1])).s;
    else t.e=null;
    t.d=d;prev=t;
  });
  tasks.forEach(t=>{
    if(t.start&&!/^after\s/.test(t.start)&&t.s!=null&&!t.deps.length){
      let best=/** @type {GanttTask|null} */(null);tasks.forEach(o=>{if(o!==t&&o.e!=null&&o.e<=/** @type {number} */(t.s)&&
tasks.indexOf(o)<tasks.indexOf(t)&&(!best||o.e>/** @type {number} */(best.e)))best=o});
      if(best){t.deps=[best];t.soft=true}
    }
  });
  /** @param {number} ms */
  const fd=ms=>{const d=new Date(ms);return d.getUTCDate()+' '+['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getUTCMonth()]+' '+d.getUTCFullYear()};
  /** @param {number} ms */
  const fdur=ms=>{const dd=ms/DAY;if(dd>=1){const w=dd/7;return Number.isInteger(w)&&w>1?w+' weeks':(Math.round(dd*10)/10)+(dd===1?' day':' days')}const h=ms/36e5;return h>=1?Math.round(h*10)/10+' hours':Math.round(ms/6e4)+' minutes'};
  tasks.forEach(t=>{const n=K.node(t.id,t.label,t.tags.includes('milestone')?'circle':'box');n.group=t.section;
    if(t.tags.includes('milestone'))n.icon='🚩';else if(t.tags.includes('done'))n.icon='✅';else if(t.tags.includes('active'))n.icon='⏳';else if(t.tags.includes('crit'))n.icon='❗';
    t.n=n});
  const order=tasks.slice().sort((a,b)=>(a.s??Infinity)-(b.s??Infinity)||tasks.indexOf(a)-tasks.indexOf(b));
  const steps=/** @type {Step[]} */([]),B=(/** @type {string} */s)=>'**'+s+'**';
  order.forEach(t=>{

    const lis=t.deps.map(d=>K.link(d.n,t.n,{arrow:true,dotted:!!t.soft}));
    const ms=t.tags.includes('milestone'),when=t.s!=null?(ms?'is reached on '+B(fd(t.s)):'starts on '+B(fd(t.s))):'';
    let auto;
    if(t.deps.length&&!t.soft)auto=B(t.label)+(ms?' is reached':' starts')+' once '+t.deps.map(d=>B(d.label)).join(' and ')+(t.deps.length>1?' are':' is')+' finished'+(t.s!=null?' ('+fd(t.s)+')':'')+'.';
    else auto=B(t.label)+' '+(when||(ms?'is a milestone':'begins'))+'.';
    if(!ms&&t.s!=null&&t.e!=null)auto+=' It takes '+fdur(t.e-t.s)+' and ends on '+fd(t.e)+'.';
    else if(!ms&&t.d!=null)auto+=' It takes '+fdur(t.d)+'.';
    const st=t.tags.includes('done')?'Done':t.tags.includes('active')?'In progress':t.tags.includes('crit')?'Critical':'';
    const tag=[t.section!=null?K.groups[t.section].title:'',st].filter(Boolean).join(' · ');
    const chip=t.s!=null?fd(t.s):'';
    if(lis.length){const last=t.deps.reduce((a,d,k)=>(d.e??-1)>(t.deps[a].e??-1)?k:a,0);const s=K.edgeStep(lis[last],{auto,tag,title:t.label});s.chip=chip;s.nodes=[...t.deps.map(d=>d.n.id),t.n.id];steps.push(s)}
    else steps.push(K.nodeStep(t.n,{auto,tag}));
    if(t.s!=null)t.n.note=(ms?'Date: ':'When: ')+fd(t.s)+(!ms&&t.e!=null?' → '+fd(t.e):'')+(st?' · '+st:'');
  });
  return {type:'gantt',nodes:[...K.nodes.values()],links:K.links,steps,groups:K.groups,diagramTitle:title};
}

/* ---------- mermaid: pie ---------- */
/** @param {string} first @param {string[]} ls @returns {Graph} */
export function parsePie(first,ls){
  let title=(first.match(/^pie\b(?:\s+showData)?(?:\s+title\s+(.+))?$/i)||[])[1]||'';const slices=/** @type {Array<{label:string,v:number}>} */([]);
  for(const line of ls){let m;
    if(m=line.match(/^title\s+(.+)$/i)){title=m[1];continue}
    if(m=line.match(/^"([^"]+)"\s*:\s*(-?\d+(?:\.\d+)?)$/))slices.push({label:cleanText(m[1]),v:+m[2]});
  }
  if(!slices.length)throw new Error('No slices found in the pie chart. Write them like  "Dogs" : 42');
  const tot=slices.reduce((s,x)=>s+Math.max(0,x.v),0)||1,max=Math.max(...slices.map(x=>x.v),1e-9);
  const pct=(/** @type {number} */v)=>{const p=v/tot*100;return (p>=10||Number.isInteger(p)?Math.round(p):Math.round(p*10)/10)+'%'};
  const fmt=(/** @type {number} */v)=>Number.isInteger(v)?v.toLocaleString('en-US'):String(v);
  const nodes=slices.map((s,i)=>({id:'slice'+(i+1),label:s.label+' · '+pct(s.v),shape:'box',group:null,ci:i,hk:.35+2.3*Math.max(0,s.v)/max,gx:i*2.7,gy:0,note:fmt(s.v)+' of '+fmt(tot)+' in total ('+pct(s.v)+').'}));
  const rank=slices.map((s,i)=>i).sort((a,b)=>slices[b].v-slices[a].v);
  const steps=rank.map((i,k)=>{const s=slices[i];
    const pos=k===0?'the biggest share':k===rank.length-1&&rank.length>2?'the smallest share':'number '+(k+1)+' of '+rank.length;
    return {kind:'node',nodes:[nodes[i].id],title:s.label,chip:pct(s.v),auto:'**'+s.label+'** is **'+pct(s.v)+'** of the total ('+fmt(s.v)+' of '+fmt(tot)+') — '+pos+'.'}});
  return {type:'pie',nodes,links:[],steps,groups:[],fixed:true,diagramTitle:cleanText(title)};
}

/* ---------- mermaid: mindmap ---------- */
/** @param {string} code @returns {Graph} */
export function parseMindmap(code){
  let raw=code.replace(/\r/g,'').split('\n');
  if(raw.find(l=>l.trim())?.trim()==='---'){const a=raw.findIndex(l=>l.trim()==='---'),b=raw.findIndex((l,i)=>i>a&&l.trim()==='---');if(b>a)raw=raw.slice(b+1)}
  raw=raw.map(l=>l.replace(/%%.*$/,'').replace(/\t/g,'    ')).filter(l=>l.trim());
  const hi=raw.findIndex(l=>/^\s*mindmap\b/.test(l));raw=raw.slice(hi+1);
  const K=graphKit(),steps=/** @type {Step[]} */([]),stack=/** @type {Array<{ind:number,n:FxNode}>} */([]);let count=0;
  /** @type {Array<[RegExp,string]>} */
  const FORMS=[[/^\(\((.*)\)\)$/s,'circle'],[/^\)\)(.*)\(\($/s,'pill'],[/^\)(.*)\($/s,'pill'],[/^\{\{(.*)\}\}$/s,'box'],[/^\((.*)\)$/s,'pill'],[/^\[(.*)\]$/s,'box']];
  for(const l of raw){
    const t=l.trim();if(/^::icon\(/.test(t)||/^:::/.test(t))continue;
    const ind=/** @type {RegExpMatchArray} */(l.match(/^ */))[0].length;
    const body=t.replace(/:::[\w\s-]+$/,'').trim();let label=body,shape='box';

    const idm=body.match(/^([\w-]+)(?=[[({)])/);const rest=idm?body.slice(idm[0].length):body;
    for(const [re,sh] of FORMS){const m=rest.match(re);if(m){label=m[1];shape=sh;break}}
    if(label===body&&idm)label=body;
    const n=K.node('m'+(++count),cleanText(label)||'…',shape);
    while(stack.length&&stack[stack.length-1].ind>=ind)stack.pop();
    const parent=stack.length?stack[stack.length-1].n:null;
    if(parent){
      n.group=parent.group!=null?parent.group:(stack.length===1?(K.groups.push({title:n.label}),K.groups.length-1):null);
      const li=K.link(parent,n,{});const top=stack.length===1;
      steps.push(K.edgeStep(li,{title:n.label,auto:top?'One main part of **'+parent.label+'** is **'+n.label+'**.':'**'+parent.label+'** includes **'+n.label+'**.',tag:n.group!=null?K.groups[n.group].title:''}));
    }else n.group=null;
    stack.push({ind,n});
  }
  const N=[...K.nodes.values()];if(!N.length)throw new Error('The mindmap is empty.');
  const roots=N.filter(n=>!K.links.some(l=>l.to===n.id));roots.forEach(r=>r.icon='💡');
  return {type:'mindmap',nodes:N,links:K.links,steps,groups:K.groups,noZones:true};
}

/* ---------- mermaid: fixed-position helpers ---------- */
/** Straight / elbow arrow points for parsers that place their own nodes (every node has gx/gy). @param {FxNode[]} nodes @param {FxLink[]} links */
export function routeFixed(nodes,links){
  const by=/** @type {Map<string,PlacedNode>} */(new Map(nodes.map(n=>[n.id,n])));
  links.forEach(l=>{
    const a=by.get(l.from),b=by.get(l.to);if(!a||!b||a===b){l.pts=null;return}
    if(Math.abs(a.gx-b.gx)<.02){const s=Math.sign(b.gy-a.gy)||1;l.pts=[[a.gx,a.gy+s*T0],[b.gx,b.gy-s*T1]];return}
    const s=Math.sign(b.gx-a.gx)||1;
    if(Math.abs(a.gy-b.gy)<.02){l.pts=[[a.gx+s*T0,a.gy],[b.gx-s*T1,b.gy]];return}
    const x0=a.gx+s*T0,x1=b.gx-s*T1,xm=s>0?Math.min((x0+x1)/2,x1-.8):Math.max((x0+x1)/2,x1+.8);
    l.pts=[[a.gx+s*T0,a.gy],[xm,a.gy],[xm,b.gy],[b.gx-s*T1,b.gy]];
  });
}
/** @param {string} s @param {string} k */
export const kv=(s,k)=>{const m=s.match(new RegExp('\\b'+k+'\\s*:\\s*(?:"([^"]*)"|([^\\s,]+))'));return m?(m[1]??m[2]):null};

/* ---------- mermaid: journey ---------- */
/** @param {string[]} ls @returns {Graph} */
export function parseJourney(ls){
  const K=graphKit(),tasks=/** @type {Array<{n:FxNode,sc:number,raw:string,who:string[],section:number|null}>} */([]);let title='',section=/** @type {number|null} */(null);
  // index 0 is never used: scores are clamped to 1..5
  const MOOD=/** @type {Array<[string,string]>} */([null,['very unhappy','😫'],['frustrating','😟'],['okay','😐'],['good','🙂'],['great','😀']]);
  for(const line of ls){let m;
    if(m=line.match(/^title\s+(.+)$/)){title=cleanText(m[1]);continue}
    if(/^(accTitle|accDescr)\b/.test(line))continue;
    if(m=line.match(/^section\s+(.+)$/)){K.groups.push({title:cleanText(m[1])});section=K.groups.length-1;continue}
    if(m=line.match(/^(.+?)\s*:\s*(\d+(?:\.\d+)?)\s*(?::\s*(.*))?$/)){
      const sc=Math.max(1,Math.min(5,Math.round(+m[2]))),who=(m[3]||'').split(',').map(s=>cleanText(s)).filter(Boolean);
      const n=K.node('t'+(tasks.length+1),cleanText(m[1]));n.group=section;n.hk=.45+.32*sc;n.icon=MOOD[sc][1];
      n.note='Feeling: '+MOOD[sc][0]+' ('+sc+' out of 5).'+(who.length?' Who: '+who.join(', ')+'.':'');
      tasks.push({n,sc,raw:String(sc),who,section});
    }
  }
  if(!tasks.length)throw new Error('No steps found in the journey. Write them like  Pay for ticket: 3: Customer');
  const B=(/** @type {string} */s)=>'**'+s+'**',steps=/** @type {Step[]} */([]);
  tasks.forEach((t,i)=>{
    const feel=MOOD[t.sc][0]
,whoTxt=t.who.length?' for '+t.who.map(B).join(t.who.length>2?', ':' and ').replace(/, ([^,]*)$/,' and $1'):'';
    const auto=(i===0?'It starts with '+B(t.n.label)+'. ':'Next: '+B(t.n.label)+'. ')+'This feels '+B(feel)+whoTxt+' ('+t.raw+' out of 5).'+(t.sc<=2?' A pain point worth fixing.':'');
    const tag=t.section!=null?K.groups[t.section].title:'',chip=MOOD[t.sc][1]+' '+t.raw+'/5';
    if(i===0){const s=K.nodeStep(t.n,{auto,tag});s.chip=chip;steps.push(s)}
    else steps.push(K.edgeStep(K.link(tasks[i-1].n,t.n,{arrow:true}),{auto,tag,chip,title:t.n.label}));
  });
  return {type:'journey',nodes:[...K.nodes.values()],links:K.links,steps,groups:K.groups,diagramTitle:title};
}

/* ---------- mermaid: timeline ---------- */
/** @param {string[]} ls @returns {Graph} */
export function parseTimeline(ls){
  const K=graphKit(),periods=/** @type {Array<{label:string,ev:string[],section:number|null}>} */([]);let title='',section=/** @type {number|null} */(null);
  for(const line of ls){let m;
    if(m=line.match(/^title\s+(.+)$/)){title=cleanText(m[1]);continue}
    if(/^(accTitle|accDescr|direction)\b/.test(line))continue;
    if(m=line.match(/^section\s+(.+)$/)){K.groups.push({title:cleanText(m[1])});section=K.groups.length-1;continue}
    if(line.startsWith(':')){const p=periods[periods.length-1];if(p)line.split(':').map(cleanText).filter(Boolean).forEach(e=>p.ev.push(e));continue}
    const parts=line.split(/\s*:\s+|\s+:\s*/);
    periods.push({label:cleanText(parts[0]),ev:parts.slice(1).map(cleanText).filter(Boolean),section});
  }
  if(!periods.length)throw new Error('No periods found in the timeline. Write them like  2024 : Shop opens');
  const steps=/** @type {Step[]} */([]),B=(/** @type {string} */s)=>'**'+s+'**';let prev=/** @type {FxNode|null} */(null);
  periods.forEach((p,i)=>{
    const n=K.node('p'+(i+1),p.label,'box');n.group=p.section;n.gx=i*DX;n.gy=0;n.icon='📅';
    const evs=p.ev.map((e,k)=>{const en=K.node('p'+(i+1)+'e'+(k+1),e,'pill');en.group=p.section;en.gx=i*DX;en.gy=(k+1)*2.9;K.link(n,en,{dotted:true});return en});
    const tag=p.section!=null?K.groups[p.section].title:'';
    const auto=B(p.label)+(evs.length?': '+p.ev.map(B).join(evs.length>2?', ':' and ').replace(/, ([^,]*)$/,' and $1')+'.':'.');
    let s;
    if(prev)s=K.edgeStep(K.link(prev,n,{arrow:true}),{auto,tag,title:p.label});else s=K.nodeStep(n,{auto,tag});
    s.nodes=[...(prev?[prev.id]:[]),n.id,...evs.map(e=>e.id)];
    if(p.ev.length)n.note=p.ev.join(' · ');
    steps.push(s);prev=n;
  });
  const N=[...K.nodes.values()];routeFixed(N,K.links);
  return {type:'timeline',nodes:N,links:K.links,steps,groups:K.groups,fixed:true,diagramTitle:title};
}

/* ---------- mermaid: quadrant ---------- */
/** @param {string[]} ls @returns {Graph} */
export function parseQuadrant(ls){
  let title='',xa=['',''],ya=['',''];const q=['','','',''],pts=/** @type {Array<{label:string,x:number,y:number}>} */([]);
  for(const line of ls){let m;
    if(m=line.match(/^title\s+(.+)$/)){title=cleanText(m[1]);continue}
    if(m=line.match(/^([xy])-axis\s+(.+?)(?:\s*-->\s*(.+))?$/)){const v=[cleanText(m[2]),cleanText(m[3]||'')];if(m[1]==='x')xa=v;else ya=v;continue}
    if(m=line.match(/^quadrant-([1-4])\s+(.+)$/)){q[+m[1]-1]=cleanText(m[2]);continue}
    if(/^(classDef|accTitle|accDescr)\b/.test(line))continue;
    if(m=line.match(/^(.+?)(?::::[\w-]+)?\s*:\s*\[\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\]/))pts.push({label:cleanText(m[1]),x:Math.max(0,Math.min(1,+m[2])),y:Math.max(0,Math.min(1,+m[3]))});
  }
  if(!pts.length)throw new Error('No points found in the quadrant chart. Write them like  Gift cards: [0.3, 0.8]');
  const qn=(/** @type {{x:number,y:number}} */p)=>p.y>=.5?(p.x>=.5?0:1):(p.x<.5?2:3);
  const groups=q.map((t,i)=>({title:t||['Top right','Top left','Bottom left','Bottom right'][i]}));
  const S=Math.max(12,Math.sqrt(pts.length)*4.4);
  const nodes=pts.map((p,i)=>({id:'pt'+(i+1),label:p.label,shape:'box',group:qn(p),gx:p.x*S,gy:(1-p.y)*S,note:''}));
  for(let it=0;it<60;it++)for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
    const a=nodes[i],b=nodes[j],dx=b.gx-a.gx,dy=b.gy-a.gy,d=Math.hypot(dx,dy),min=3;
    if(d<min){const k=(min-d)/2/(d||1),ux=d?dx:1,uy=d?dy:0;a.gx-=ux*k;a.gy-=uy*k;b.gx+=ux*k;b.gy+=uy*k}
  }
  /** @param {number} v @param {string[]} ax @param {string} dir */
  const lvl=(v,ax,dir)=>
(v>=.5?ax[1]:ax[0])||((v>=.5?'high':'low')+' '+dir+' ('+Math.round(v*100)+'%)');
  const B=(/** @type {string} */s)=>'**'+s+'**';
  const steps=pts.map((p,i)=>{const n=nodes[i],g=groups[n.group].title;
    n.note='Across: '+Math.round(p.x*100)+'%'+(xa[0]?' ('+xa[0]+' → '+(xa[1]||'')+')':'')+'. Up: '+Math.round(p.y*100)+'%'+(ya[0]?' ('+ya[0]+' → '+(ya[1]||'')+')':'')+'.';
    const auto=B(p.label)+' is '+B(lvl(p.x,xa,'across').toLowerCase())+' and '+B(lvl(p.y,ya,'up').toLowerCase())+', so it lands in '+B(g)+'.';
    return {kind:'node',nodes:[n.id],title:p.label,chip:g,auto,tag:g}});
  const order=steps.map((s,i)=>i).sort((a,b)=>nodes[a].group-nodes[b].group||pts[b].y-pts[a].y);
  return {type:'quadrant',nodes,links:[],steps:order.map(i=>steps[i]),groups,fixed:true,diagramTitle:title||(xa[0]&&ya[0]?xa[0].replace(/^low\s+/i,'')+' vs '+ya[0].replace(/^low\s+/i,''):'')};
}

/* ---------- mermaid: git graph ---------- */
/** @typedef {{name:string,lane:number,g:number,head:GitCommit|null,count:number}} GitBranch */
/** @typedef {{id?:string|null,tag?:string|null,type?:string,kind:string,from?:string}} GitOpts */
/** @typedef {{n:FxNode,b:GitBranch,parent:GitCommit|null,o:GitOpts}} GitCommit */
/** @param {string[]} ls @returns {Graph} */
export function parseGit(ls){
  const K=graphKit(),branches=/** @type {Map<string,GitBranch>} */(new Map()),commits=/** @type {GitCommit[]} */([]),steps=/** @type {Step[]} */([]),byId=/** @type {Map<string|null,GitCommit>} */(new Map()),B=(/** @type {string} */s)=>'**'+s+'**';
  let cur='main';
  /** @param {string} name @returns {GitBranch} */
  const br=name=>{name=name.replace(/^"|"$/g,'');if(!branches.has(name)){K.groups.push({title:name});branches.set(name,{name,lane:branches.size,g:K.groups.length-1,head:null,count:0})}return /** @type {GitBranch} */(branches.get(name))};
  br('main');
  /** @param {GitOpts} o @returns {GitCommit} */
  const add=(o)=>{

    const b=br(cur),i=commits.length;b.count++;
    const id=o.id||(o.kind==='merge'?'Merge '+o.from:b.name+' #'+b.count);
    const n=K.node('c'+(i+1),cleanText(id),o.kind==='merge'?'hex':'circle');n.group=b.g;n.gx=i*DX;n.gy=b.lane*DY;
    if(o.tag){n.icon='🏷️';n.note='Tag: '+o.tag+'.'}
    if(o.type==='HIGHLIGHT')n.icon=n.icon||'⭐';if(o.type==='REVERSE')n.icon='↩️';if(o.kind==='pick')n.icon='🍒';
    const c={n,b,parent:b.head,o};commits.push(c);if(o.id)byId.set(o.id,c);b.head=c;return c;
  };
  for(const line of ls){let m;
    if(/^(accTitle|accDescr|%%)/.test(line))continue;
    if(m=line.match(/^commit\b(.*)$/)){
      const r=m[1],c=add({id:kv(r,'id')||kv(r,'msg'),tag:kv(r,'tag'),type:(kv(r,'type')||'').toUpperCase(),kind:'commit'});
      const p=c.parent,tagTxt=c.o.tag?' It is marked as '+B(c.o.tag)+'.':'';
      let auto;
      if(!p)auto='The project starts on '+B(c.b.name)+' with '+B(c.n.label)+'.';
      else if(p.b!==c.b)auto='A separate copy called '+B(c.b.name)+' splits off from '+B(p.b.name)+' at '+B(p.n.label)+', and saves its first change: '+B(c.n.label)+'.';
      else auto=B(c.b.name)+' saves a new change: '+B(c.n.label)+'.';
      if(c.o.type==='REVERSE')auto+=' This change undoes an earlier one.';
      auto+=tagTxt;
      if(p)steps.push(K.edgeStep(K.link(p.n,c.n,{arrow:true}),{auto,tag:c.b.name,chip:c.o.tag||'',title:c.n.label}));
      else steps.push(K.nodeStep(c.n,{auto,tag:c.b.name}));
      continue;
    }
    if(m=line.match(/^branch\s+("[^"]+"|\S+)/)){const nb=br(m[1]);nb.head=br(cur).head;cur=nb.name;continue}
    if(m=line.match(/^(?:checkout|switch)\s+("[^"]+"|\S+)/)){cur=br(m[1]).name;continue}
    if(m=line.match(/^merge\s+("[^"]+"|\S+)(.*)$/)){
      const from=br(m[1]),r=m[2],into=br(cur),p=into.head,oh=from.head;
      const c=add({id:kv(r,'id'),tag:kv(r,'tag'),type:(kv(r,'type')||'').toUpperCase(),kind:'merge',from:from.name});
      const ids=[];if(p)ids.push(p.n.id);let li=null;
      if(p)K.link(p.n,c.n,{arrow:true});
      if(oh){li=K.link(oh.n,c.n,{arrow:true});ids.push(oh.n.id)}
      const auto='All the work on '+B(from.name)+' is merged back into '+B(into.name)+'.'+(c.o.tag?' This version is marked as '+B(c.o.tag)+'.':'');
      const s=li!=null?K.edgeStep(li,{auto,tag:into.name,chip:c.o.tag||'merge',title:from.name+' → '+into.name}):K.nodeStep(c.n,{auto,tag:into.name});
      s.nodes=[...ids,c.n.id];steps.push(s);continue;
    }
    if(m=line.match(/^cherry-pick\b(.*)$/)){
      const src=byId.get(kv(m[1],'id')),c=add({id:src?src.n.label+' (copy)':null,tag:kv(m[1],'tag'),kind:'pick'}),p=c.parent;
      if(p)K.link(p.n,c.n,{arrow:true});
      const auto=src?'One change, '+B(src.n.label)+', is copied from '+B(src.b.name)+' onto '+B(c.b.name)+' on its own.':B(c.b.name)+' copies in a single change from another branch.';
      if(src){const s=K.edgeStep(K.link(src.n,c.n,{arrow:true,dotted:true}),{auto,tag:c.b.name,chip:'copy'});s.nodes=[...(p?[p.n.id]:[]),src.n.id,c.n.id];steps.push(s)}
      else steps.push(K.nodeStep(c.n,{auto,tag:c.b.name}));
    }
  }
  if(!commits.length)throw new Error('No commits found in the git graph.');
  const N=[...K.nodes.values()];routeFixed(N,K.links);
  return {type:'git',nodes:N,links:K.links,steps,groups:K.groups,fixed:true};
}

/* ---------- mermaid: helpers for the chart-like types ---------- */
/** @param {unknown} v @returns {v is number} */
export const isNum=v=>typeof v==='number';
/** @param {number} v */
export const fmtNum=v=>Number.isInteger(v)?v.toLocaleString('en-US'):v.toLocaleString('en-US',{maximumFractionDigits:2});
/** @param {string} s */
export const humanId=s=>{s=cleanText(s);return /\s/.test(s)||!/[_-]/.test(s)?s:s.replace(/[_-]+/g,' ').replace(/^./,c=>c.toUpperCase())};
/** @param {string[]} a @param {(s:string)=>string} B */
export const andList=(a,B)=>{a=a.map(B);return a.length<2?a.join(''):a.slice(0,-1).join(', ')+' and '+a[a.length-1]};
/** @param {string} s */
export const lcFirst=s=>/^[A-Z][a-z]/.test(s)?s[0].toLowerCase()+s.slice(1):s;
/** @param {string} s @returns {string[]} */
export function splitArgs(s){const out=[];let cur='',q=false;for(const ch of s){if(ch==='"'){q=!q;continue}if(ch===','&&!q){out.push(cur.trim());cur='';continue}cur+=ch}if(cur.trim()||out.length)out.push(cur.trim());return out}
/** @param {string} l @returns {string[]} */
export function splitCsv(l){const out=[];let cur='',q=false;for(let i=0;i<l.length;i++){const ch=l[i];if(q){if(ch==='"'&&l[i+1]==='"'){cur+='"';i++}else if(ch==='"')q=false;else cur+=ch}else if(ch==='"')q=true;else if(ch===','){out.push(cur);cur=''}else cur+=ch}out.push(cur);return out.map(s=>s.trim())}

/* ---------- mermaid: xy chart ---------- */
/** @param {string[]} ls @returns {Graph} */
export function parseXY(ls){
  /** @type {string[]|null} */ let cats=null;/** @type {number[]|null} */ let range=null;/** @type {number|null} */ let ymin=null;/** @type {number|null} */ let ymax=null;
  let title='',yTitle='',xTitle='';
  /** @type {{kind:string,name:string,v:number[]}[]} */
  const series=[];
  /** @param {string} s */
  const list=s=>splitArgs(s).map(cleanText).filter(x=>x!=='');
  for(const line of ls){let m;
    if(m=line.match(/^title\s+(.+)$/)){title=cleanText(m[1]);continue}
    if(m=line.match(/^x-axis\s*(?:("[^"]*"|[^\s[]+)\s*)?(?:\[(.*)\]|(-?[\d.]+)\s*-->\s*(-?[\d.]+))?\s*$/)){xTitle=cleanText(m[1]||'');if(m[2]!=null)cats=list(m[2]);else if(m[3]!=null)range=[+m[3],+m[4]];continue}
    if(m=line.match(/^y-axis\s*(?:("[^"]*"|[^\s\d-][^\s]*)\s*)?(?:(-?[\d.]+)\s*-->\s*(-?[\d.]+))?\s*$/)){yTitle=cleanText(m[1]||'');if(m[2]!=null){ymin=+m[2];ymax=+m[3]}continue}
    if(m=line.match(/^(bar|line)\s*(?:("[^"]*"|[^\s[]+)\s*)?\[(.*)\]\s*$/))series.push({kind:m[1],name:cleanText(m[2]||''),v:list(m[3]).map(Number).filter(x=>!isNaN(x))});
  }
  if(!series.length||!series.some(s=>s.v.length))throw new Error('No data found in the xy chart. Write it like  bar [5000, 6000, 7500]');
  const n=Math.max(...series.map(s=>s.v.length));
  if(!cats||cats.length<n){const c=cats||[];cats=Array.from({length:n},(_,i)=>c[i]??(range?fmtNum(Math.round((range[0]+(range[1]-range[0])*(n>1?i/(n-1):0))*100)/100):String(i+1)))}
  const all=series.flatMap(s=>s.v),lo=ymin!=null?ymin:Math.min(0,...all),hi=Math.max(ymax!=null?ymax:-Infinity,...all),span=hi-lo||1;
  /** @type {Record<string,number>} */ const counts={bar:0,line:0};
  series.forEach(s=>{counts[s.kind]++;s.name=s.name||(series.length===1?(yTitle||'Value'):(s.kind==='bar'?'Bars':'Line')+(series.filter(x=>x.kind===s.kind).length>1?' '+counts[s.kind]:''))});
  const multi=series.length>1,groups=multi?series.map(s=>({title:s.name})):[],nodes=/** @type {FxNode[]} */([]),links=/** @type {FxLink[]} */([]);
  series.forEach((s,si)=>s.v.forEach((v,i)=>{
    /** @type {FxNode} */ const nd={id:'s'+si+'p'+i,label:cats[i]+' · '+fmtNum(v),shape:s.kind==='line'?'circle':'box',group:multi?si:null,ci:si,gx:i*2.7,gy:si*2.9,hk:.3+2.3*Math.max(0,v-lo)/span,
      note:(multi?s.name+': ':'')+fmtNum(v)+(yTitle&&!multi?' ('+yTitle+')':'')+'.'};
    if(s.kind==='line')nd.icon='📈';nodes.push(nd);
    if(s.kind==='line'&&i>0)links.push({from:'s'+si+'p'+(i-1),to:nd.id,label:'',dotted:false,arrow:true});
  }));
  routeFixed(nodes,links);
  const B=(/** @type {string} */s)=>'**'+s+'**',main=series[0];
  const steps=cats.slice(0,n).map((c,i)=>{
    const ids=series.filter(s=>i<s.v.length).map(s=>'s'+series.indexOf(s)+'p'+i);
    let auto;
    if(!multi){const v=main.v[i],p=i?main.v[i-1]:null,mx=Math.max(...main.v),mn=Math.min(...main.v);
      auto=(i===0?'It starts at '+B(fmtNum(v))+' in '+B(c):'In '+B(c)+': '+B(fmtNum(v)))+(p!=null&&p?(v===p?', the same as '+cats[i-1]:(v>p?', up ':', down ')+Math.abs(Math.round((v-p)/Math.abs(p)*100))+'% from '+cats[i-1]):'')+'.'+(v===mx&&main.v.length>2?' This is the highest point.':v===mn&&main.v.length>2?' This is the lowest point.':'');}
    else auto=B(c)+': '+series.filter(s=>i<s.v.length).map(s=>s.name+' '+B(fmtNum(s.v[i]))).join(', ')+'.';
    const li=links.findIndex(l=>l.to===ids.find(id=>nodes.find(x=>x.id===id)?.shape==='circle'));
    /** @type {Step} */ const s=li>=0?{kind:'edge',link:li,reverse:false,from:links[li].from,to:links[li].to,nodes:ids,title:c,chip:multi?'':fmtNum(main.v[i]),auto}:{kind:'node',nodes:ids,title:c,chip:multi?'':fmtNum(main.v[i]),auto};
    if(li>=0&&!ids.includes(links[li].from))s.nodes=[links[li].from,...ids];
    return s;
  });
  return {type:'xy',nodes,links,steps,groups,fixed:true,diagramTitle:title||(yTitle&&xTitle?yTitle+' by '+lcFirst(xTitle):yTitle)};
}

/* ---------- mermaid: sankey ---------- */
/** @param {string[]} ls @returns {Graph} */
export function parseSankey(ls){
  const K=graphKit();
  /** @type {{a:string,b:string,v:number,li:number}[]} */
  const flows=[];
  for(const line of ls){const f=splitCsv(line);if(f.length<3)continue;const v=+f[2];if(!f[0]||!f[1]||isNaN(v))continue;flows.push({a:cleanText(f[0]),b:cleanText(f[1]),v,li:-1})}
  if(!flows.length)throw new Error('No flows found in the sankey diagram. Write each line as  From,To,Amount');
  /** @param {string} s */
  const id=s=>'k_'+s;
  /** @type {Map<string,number>} */ const inn=new Map();
  /** @type {Map<string,number>} */ const out=new Map();
  /** @param {Map<string,number>} m @param {string} k @param {number} v */
  const add=(m,k,v)=>m.set(k,(m.get(k)||0)+v);
  flows.forEach(f=>{f.li=K.link(K.node(id(f.a),f.a),K.node(id(f.b),f.b),{label:fmtNum(f.v),arrow:true});add(out,f.a,f.v);add(inn,f.b,f.v)});
  const N=[...K.nodes.values()],thr=(/** @type {string} */s)=>Math.max(inn.get(s)||0,out.get(s)||0),mx=Math.max(...N.map(n=>thr(n.label)))||1;
  N.forEach(n=>{const i=inn.get(n.label)||0,o=out.get(n.label)||0;n.hk=.45+1.6*thr(n.label)/mx;
    n.note=[i?'Comes in: '+fmtNum(i)+'.':'',o?'Goes out: '+fmtNum(o)+'.':'',i&&o&&Math.abs(i-o)>1e-9?(i>o?'Keeps ':'Adds ')+fmtNum(Math.abs(i-o))+'.':''].filter(Boolean).join(' ');
    if(!i)n.icon='🚰';else if(!o)n.icon='🎯'});
  const B=(/** @type {string} */s)=>'**'+s+'**';
  const steps=flows.map(f=>{const share=Math.round(f.v/(out.get(f.a)||1)*100);
    return K.edgeStep(f.li,{chip:fmtNum(f.v),auto:B(f.a)+' sends '+B(fmtNum(f.v))+' to '+B(f.b)+(share<100?' — '+share+'% of everything leaving '+f.a+'.':' — all of it.')})});
  return {type:'sankey',nodes:N,links:K.links,steps,groups:[]};
}

/* ---------- mermaid: block ---------- */
/** @typedef {{span:number,cols?:number,items?:BlockItem[],g?:number|null,space?:boolean,n?:FxNode,w?:number,h?:number,x?:number,y?:number,ww?:number,ncol?:number,cw?:number,rows?:BlockItem[][]}} BlockItem */
/** @typedef {{a:string,b:string,label:string,arrow:boolean,dotted:boolean,aName?:string,bName?:string}} BlockLink */
/** @param {string[]} ls @returns {Graph} */
export function parseBlock(ls){
  /** @type {Map<string,FxNode>} */ const nodes=new Map();
  /** @type {BlockLink[]} */ const links=[];
  /** @type {Group[]} */ const groups=[];
  /** @type {BlockItem} */ const root={cols:0,items:[],g:null,span:1};
  const stack=[root];
  /** @type {Map<string,BlockItem>} */ const byBlock=new Map();
  const OPEN=[['(((',')))','circle'],['((','))','circle'],['([','])','pill'],['[(',')]','cyl'],['[[',']]','box'],['{{','}}','hex'],['<[',']>','pill'],['[/','/]','box'],['[\\','\\]','box'],['[/','\\]','box'],['[\\','/]','box'],['[',']','box'],['(',')','pill'],['{','}','hex'],['>',']','box']];
  /** @param {string} line */
  const tokens=line=>{const out=[];let i=0;
    while(i<line.length){
      while(line[i]===' ')i++;if(i>=line.length)break;
      const idm=line.slice(i).match(/^[^\s[\](){}<>:"]+/);if(!idm){i++;continue}
      const id=idm[0];let label=null,shape='box',arrow=false;i+=id.length;
      for(const [o,c,sh] of OPEN){if(!line.startsWith(o,i))continue;let j=i+o.length,q=false;
        for(;j<line.length;j++){if(line[j]==='"')q=!q;else if(!q&&line.startsWith(c,j))break}
        label=cleanText(line.slice(i+o.length,j));shape=sh;arrow=o==='<[';i=j+c.length;break}
      if(arrow){const dm=line.slice(i).match(/^\(([\w,\s]+)\)/);if(dm)i+=dm[0].length;label=(label||'').replace(/&nbsp;/g,' ').trim()||(/** @type {Record<string,string>} */({right:'→',left:'←',up:'↑',down:'↓'})[(dm?dm[1]:'').split(',')[0].trim()]||'→')}
      let span=1;const sm=line.slice(i).match(/^:(\d+)/);if(sm){span=+sm[1];i+=sm[0].length}
      out.push({id,label,shape,span,arrow});
    }return out};
  for(const line of ls){let m;
    if(/^(classDef|class|style|accTitle|accDescr)\b/.test(line))continue;
    const top=stack[stack.length-1];
    if(m=line.match(/^columns\s+(\d+|auto)$/)){top.cols=m[1]==='auto'?0:+m[1];continue}
    if(m=line.match(/^block(?::([^\s:[]+))?(?:\["?([^"\]]*)"?\])?(?::(\d+))?$/)){
      groups.push({title:cleanText(m[2]||'')||humanId(m[1]||'Group '+(groups.length+1))});
      /** @type {BlockItem} */ const c={cols:0,items:[],g:groups.length-1,span:+(m[3]||1)};if(m[1])byBlock.set(m[1],c);(top.items||[]).push(c);stack.push(c);continue}
    if(line==='end'){if(stack.length>1)stack.pop();continue}
    if(m=line.match(/^([^\s"]+)\s*(?:--\s*"([^"]*)"\s*(-->|---)|(-->|---|==>|-\.->|-\.-))\s*([^\s"]+)$/)){links.push({a:m[1],b:m[5],label:cleanText(m[2]||''),arrow:/>$/.test(m[3]||m[4]),dotted:/\./.test(m[4]||'')});continue}
    for(const t of tokens(line)){
      const items=top.items||[];
      if(t.id==='space'){items.push({space:true,span:t.span});continue}
      if(!nodes.has(t.id))nodes.set(t.id,{id:t.id,label:t.label||t.id,shape:t.shape,group:top.g??null});
      const n=/** @type {FxNode} */(nodes.get(t.id));if(t.label){n.label=t.label;n.shape=t.shape}if(t.arrow)n.icon=/** @type {Record<string,string>} */({'↓':'⬇️','↑':'⬆️','←':'⬅️'})[n.label]||'➡️';
      items.push({n,span:t.span});
    }
  }
  /** @param {BlockItem} it @returns {FxNode[]} */
  const leaves0=it=>it.items?it.items.flatMap(leaves0):it.n?[it.n]:[];
  links.forEach(l=>{for(const e of /** @type {('a'|'b')[]} */(['a','b'])){const blk=byBlock.get(l[e]);if(!nodes.has(l[e])&&blk){const ls=leaves0(blk);if(ls.length){const nm=groups[/** @type {number} */(blk.g)].title;if(e==='a')l.aName=nm;else l.bName=nm;l[e]=ls[Math.floor((ls.length-1)/2)].id}}}});
  links.forEach(l=>{for(const k of [l.a,l.b])if(!nodes.has(k)){/** @type {FxNode} */ const nn={id:k,label:k,shape:'box',group:null};nodes.set(k,nn);(root.items||[]).push({n:nn,span:1})}});
  if(!nodes.size)throw new Error('No blocks found in the block diagram.');
  /** @param {BlockItem} c @returns {{w:number,h:number}} */
  const size=c=>{const items=c.items||[];items.forEach(it=>{if(it.items)Object.assign(it,size(it));else{it.w=it.span;it.h=1}});
    const cols=c.cols||items.reduce((s,it)=>s+it.span,0)||1;c.ncol=cols;
    const cw=Math.max(1,...items.map(it=>(it.w||0)/Math.min(it.span,cols)));c.cw=cw;
    let col=0,y=0,rh=0;const rows=/** @type {BlockItem[][]} */([[]]);c.rows=rows;
    items.forEach(it=>{const sp=Math.min(it.span,cols);if(col+sp>cols){y+=rh;rh=0;col=0;rows.push([])}it.x=col*cw;it.y=y;it.ww=sp*cw;col+=sp;rh=Math.max(rh,it.h||0);rows[rows.length-1].push(it)});
    return {w:cols*cw,h:y+rh}};
  size(root);
  /** @param {BlockItem} c @param {number} ox @param {number} oy @returns {void} */
  const place=(c,ox,oy)=>(c.items||[]).forEach(it=>{const x=it.x||0,y=it.y||0,ww=it.ww||0;if(it.items)place(it,ox+x+(ww-(it.w||0))/2,oy+y);else if(it.n){it.n.gx=(ox+x+ww/2)*DX;it.n.gy=(oy+y+.5)*DY*1.15}});
  place(root,0,0);
  const N=[...nodes.values()],L=links.map(l=>({from:l.a,to:l.b,label:l.label,dotted:l.dotted,arrow:l.arrow,an:l.aName,bn:l.bName}));routeFixed(N,L);
  const B=(/** @type {string} */s)=>'**'+s+'**',by=(/** @type {string} */id)=>/** @type {FxNode} */(nodes.get(id));/** @type {Step[]} */ let steps;
  if(L.length)steps=L.map((l,i)=>{const a={...by(l.from)},b={...by(l.to)};if(l.an)a.label=l.an;if(l.bn)b.label=l.bn;
    return {kind:'edge',link:i,reverse:false,from:a.id,to:b.id,nodes:[a.id,b.id],title:a.label+' → '+b.label,chip:l.label,tag:a.group!=null?groups[a.group].title:'',
      auto:l.label?B(a.label)+' → '+B(b.label)+': '+l.label+'.':l.arrow?B(a.label)+' hands over to '+B(b.label)+'.':B(a.label)+' is connected to '+B(b.label)+'.'}});
  else{const st=/** @type {Step[]} */([]);steps=st;const leaves=leaves0,rows=root.rows||[],gt=(/** @type {BlockItem} */it)=>groups[/** @type {number} */(it.g)].title;
    rows.forEach((row,ri)=>{const ns=row.flatMap(leaves);if(!ns.length)return;
      const inner=row.filter(it=>it.items&&leaves(it).length).map(it=>B(gt(it))+' holds '+andList(leaves(it).map(n=>n.label),B));
      st.push({kind:'node',nodes:ns.map(n=>n.id),title:rows.length>1?'Row '+(ri+1):'Blocks',auto:(rows.length>1?'Row '+(ri+1)+' has ':'This has ')+andList(/** @type {string[]} */(row.map(it=>it.items?gt(it):it.n?it.n.label:null).filter(Boolean)),B)+'.'+(inner.length?' '+inner.join('. ')+'.':'')})});}
  return {type:'block',nodes:N,links:L,steps,groups,fixed:true};
}

/* ---------- mermaid: architecture ---------- */
/** @type {Record<string,string>} */
export const ARCH_ICON={cloud:'☁️',database:'🗄️',disk:'💾',internet:'🌐',server:'🖥️'};
/** @param {string[]} ls @returns {Graph} */
export function parseArch(ls){
  const K=graphKit(),gid=new Map(),edges=[];
  /** @param {FxNode} n @param {string|undefined} ic */
  const icon=(n,ic)=>{if(!ic)return;if(ic==='database'||ic==='disk')n.shape='cyl';if(ic==='internet')n.shape='circle';
    n.icon=ARCH_ICON[ic]||(/(db|sql|dynamo|rds|mongo|redis)/i.test(ic)?'🗄️':/(s3|storage|bucket|blob)/i.test(ic)?'💾':/(lambda|function)/i.test(ic)?'⚡':/(queue|sqs|kafka|pubsub)/i.test(ic)?'📨':'🧩')};
  for(const line of ls){let m;
    if(m=line.match(/^group\s+([\w-]+)\s*(?:\(([^)]*)\))?\s*(?:\[([^\]]*)\])?(?:\s+in\s+([\w-]+))?$/)){K.groups.push({title:cleanText(m[3]||'')||humanId(m[1]),icon:m[2]||''});gid.set(m[1],K.groups.length-1);continue}
    if(m=line.match(/^(service|junction)\s+([\w-]+)\s*(?:\(([^)]*)\))?\s*(?:\[([^\]]*)\])?(?:\s+in\s+([\w-]+))?$/)){
      const n=K.node(m[2],m[1]==='junction'?'Meeting point':cleanText(m[4]||'')||humanId(m[2]),m[1]==='junction'?'circle':'box');
      n.group=m[5]&&gid.has(m[5])?gid.get(m[5]):null;if(m[1]==='junction'){n.icon='➕';n.junction=true}else icon(n,m[3]);continue}
    if(m=line.match(/^([\w-]+)(?:\{group\})?\s*:\s*([LRTB])\s*(<)?-(?:\[([^\]]*)\]-|-)(>)?\s*([LRTB])\s*:\s*([\w-]+)(?:\{group\})?$/))edges.push({a:m[1],b:m[7],label:cleanText(m[4]||''),back:!!m[3],fwd:!!m[5]});
  }
  if(!K.nodes.size)throw new Error('No services found in the architecture diagram. Write them like  service db(database)[Database]');
  const B=(/** @type {string} */s)=>'**'+s+'**',steps=[];
  for(const e of edges){
    let a=K.nodes.get(e.a)||K.node(e.a,humanId(e.a)),b=K.nodes.get(e.b)||K.node(e.b,humanId(e.b));
    if(e.back&&!e.fwd)[a,b]=[b,a];
    const li=K.link(a,b,{label:e.label,arrow:e.back||e.fwd});
    const auto=b.junction?B(a.label)+' joins the meeting point.':a.junction?'The meeting point continues to '+B(b.label)+'.':
      (e.back&&e.fwd?B(a.label)+' and '+B(b.label)+' talk to each other':e.back||e.fwd?B(a.label)+' sends to '+B(b.label):B(a.label)+' is connected to '+B(b.label))+(e.label?': '+e.label:'')+'.';
    steps.push(K.edgeStep(li,{auto,chip:e.label,tag:a.group!=null&&a.group===b.group?K.groups[a.group].title:''}));
  }
  const N=[...K.nodes.values()];
  if(!steps.length)N.forEach(n=>steps.push(K.nodeStep(n,{auto:B(n.label)+(n.group!=null?' runs in '+B(K.groups[n.group].title):'')+'.',tag:n.group!=null?K.groups[n.group].title:''})));
  return {type:'architecture',nodes:N,links:K.links,steps,groups:K.groups};
}

/* ---------- mermaid: C4 ---------- */
/** @param {string} first @param {string[]} ls @returns {Graph} */
export function parseC4(first,ls){
  const K=graphKit(),rels=[];let title='',pending=null;
  const level=(first.match(/^C4(\w+)/)||[])[1]||'Context';
  for(const line of ls){let m;
    if(m=line.match(/^title\s+(.+)$/)){title=cleanText(m[1]);continue}
    if(line==='{'){if(pending!=null){K.stack.push(pending);pending=null}continue}
    if(line==='}'){K.stack.pop();continue}
    if(!(m=line.match(/^(\w+)\s*\((.*)\)\s*(\{)?\s*(\})?$/)))continue;
    const fn=m[1],a=splitArgs(m[2]).filter(x=>!/^\$/.test(x)).map(x=>x.replace(/^"|"$/g,'')),open=!!m[3]&&!m[4];pending=null;
    if(/^(Update|Add|Show|Hide|Set)/.test(fn))continue;
    if(/Boundary$/.test(fn)||(/^(Deployment_Node|Node)(_L|_R)?$/.test(fn)&&(open||m[3]))){
      K.groups.push({title:cleanText(a[1]||a[0])+(a[2]&&!/Boundary$/.test(fn)?' ('+cleanText(a[2])+')':'')});
      if(open)K.stack.push(K.groups.length-1);else if(!m[3])pending=K.groups.length-1;continue}
    let e=fn.match(/^(Person|System|Container|Component|Node)(Db|Queue)?(_Ext)?(?:_[LR])?$/);
    if(e){const [,base,sub,ext]=e,tech2=base==='Container'||base==='Component'||base==='Node';
      const id=a[0],label=cleanText(a[1]||a[0]),tech=tech2?cleanText(a[2]||''):'',desc=cleanText(tech2?a[3]||'':a[2]||'');
      const n=K.node(id,label);n.label=label;n.shape=sub==='Db'?'cyl':sub==='Queue'||base==='Person'?'pill':'box';
      n.icon=base==='Person'?'🧑':sub==='Queue'?'📨':ext?'🌐':base==='Node'?'🖥️':'';if(!n.icon)delete n.icon;n.iconFallback=base==='Component'?'🧩':'📦';
      n.note=[desc&&/[.!?]$/.test(desc)?desc:desc?desc+'.':'',tech?'Built with: '+tech+'.':'',ext?'Outside our own system.':''].filter(Boolean).join(' ');
      continue}
    if(e=fn.match(/^(Bi)?Rel(Index)?(?:_(?:U|Up|D|Down|L|Left|R|Right|Back|Neighbor))?$/)){
      const r=e[2]?a.slice(1):a;if(r.length<2)continue;
      let [from,to]=r;if(/_Back$/.test(fn))[from,to]=[to,from];
      rels.push({from,to,label:cleanText(r[2]||''),tech:cleanText(r[3]||''),bi:!!e[1]});
    }
  }
  if(!K.nodes.size)throw new Error('No people or systems found in the C4 diagram. Write them like  Person(customer, "Customer")');
  const B=(/** @type {string} */s)=>'**'+s+'**',steps=[];
  for(const r of rels){
    const a=K.nodes.get(r.from)||K.node(r.from,humanId(r.from)),b=K.nodes.get(r.to)||K.node(r.to,humanId(r.to));
    const li=K.link(a,b,{label:r.label,arrow:true});
    const verb=r.label?lcFirst(r.label):(r.bi?'works together with':'talks to');
    const auto=B(a.label)+' '+verb+' '+B(b.label)+(r.tech?' (using '+r.tech+')':'')+'.'+(r.bi&&r.label?' This goes both ways.':'');
    steps.push(K.edgeStep(li,{auto,chip:r.tech||'',tag:a.group!=null?K.groups[a.group].title:''}));
  }
  const N=[...K.nodes.values()];
  if(!steps.length)N.forEach(n=>steps.push(K.nodeStep(n,{auto:B(n.label)+(n.note?': '+n.note:'.')})));
  return {type:'c4',nodes:N,links:K.links,steps,groups:K.groups,diagramTitle:title||(/** @type {Record<string,string>} */({Context:'System context',Container:'Containers',Component:'Components',Dynamic:'How the parts talk',Deployment:'Where it runs'})[level]||'')};
}

/* ---------- mermaid: kanban ---------- */
/** @typedef {{text:string,meta:Record<string,string>}} KanbanItem */
/** @param {string} code @returns {Graph} */
export function parseKanban(code){
  let raw=code.replace(/\r/g,'').split('\n');
  if(raw.find(l=>l.trim())?.trim()==='---'){const a=raw.findIndex(l=>l.trim()==='---'),b=raw.findIndex((l,i)=>i>a&&l.trim()==='---');if(b>a)raw=raw.slice(b+1)}
  raw=raw.map(l=>l.replace(/%%.*$/,'').replace(/\t/g,'    ')).filter(l=>l.trim());
  raw=raw.slice(raw.findIndex(l=>/^\s*kanban\b/.test(l))+1);
  if(!raw.length)throw new Error('The kanban board is empty.');
  const base=Math.min(...raw.map(l=>(l.match(/^ */)||[''])[0].length));
  /** @type {(KanbanItem & {cards:KanbanItem[]})[]} */ const cols=[];
  /** @param {string} t @returns {KanbanItem} */
  const item=t=>{const meta=/** @type {Record<string,string>} */({});const mm=t.match(/@\{(.*)\}\s*$/);if(mm){t=t.slice(0,mm.index).trim();for(const x of mm[1].matchAll(/([\w-]+)\s*:\s*(?:'([^']*)'|"([^"]*)"|([^,}]+))/g))meta[x[1].toLowerCase()]=(x[2]??x[3]??x[4]).trim()}
    const b=t.match(/^([^[\s]*)\[(.*)\]$/);return {text:cleanText(b?b[2]:t),meta}};
  for(const l of raw){const ind=(l.match(/^ */)||[''])[0].length,t=l.trim();
    if(ind<=base||!cols.length)cols.push({...item(t),cards:[]});else cols[cols.length-1].cards.push(item(t));}
  const K=graphKit(),steps=/** @type {Step[]} */([]),B=(/** @type {string} */s)=>'**'+s+'**';
  /** @type {Record<string,string>} */ const PRI={'very high':'🔴',high:'🟠',low:'🟢','very low':'⚪'};
  /** @type {FxNode|null} */ let prev=null;
  cols.forEach((c,i)=>{
    K.groups.push({title:c.text});const g=K.groups.length-1;
    const h=K.node('col'+(i+1),c.text,'box');h.group=g;h.gx=i*DX;h.gy=0;h.icon='📋';h.note=c.cards.length+' card'+(c.cards.length===1?'':'s')+'.';
    const cs=c.cards.map((d,k)=>{const n=K.node('col'+(i+1)+'c'+(k+1),d.text.length>46?d.text.slice(0,44).replace(/\s+\S*$/,'')+'…':d.text,'pill');n.group=g;n.gx=i*DX;n.gy=(k+1)*2.9;
      const pr=d.meta.priority;if(pr&&PRI[pr.toLowerCase()])n.icon=PRI[pr.toLowerCase()];
      n.note=[d.text.length>46?d.text+'.':'',d.meta.assigned?'Assigned to '+d.meta.assigned+'.':'',pr?'Priority: '+pr+'.':'',d.meta.ticket?'Ticket: '+d.meta.ticket+'.':''].filter(Boolean).join(' ');
      K.link(h,n,{dotted:true});return {n,d}});
    const who=cs.filter(x=>x.d.meta.assigned).map(x=>x.d.meta.assigned),urgent=cs.filter(x=>/high/i.test(x.d.meta.priority||''));
    const auto=(cs.length?B(c.text)+' has '+B(cs.length+' card'+(cs.length===1?'':'s'))+': '+andList(cs.map(x=>x.n.label),B)+'.':B(c.text)+' is empty right now.')
      +(urgent.length?' '+andList(urgent.map(x=>x.n.label),B)+(urgent.length>1?' are':' is')+' high priority.':'')+(who.length?' Assigned to '+[...new Set(who)].join(', ')+'.':'');
    let s;if(prev)s=K.edgeStep(K.link(prev,h,{arrow:true}),{auto,title:c.text,chip:cs.length+''});else{s=K.nodeStep(h,{auto});s.chip=cs.length+''}
    s.nodes=[...(prev?[prev.id]:[]),h.id,...cs.map(x=>x.n.id)];steps.push(s);prev=h;
  });
  const N=[...K.nodes.values()];routeFixed(N,K.links);
  return {type:'kanban',nodes:N,links:K.links,steps,groups:K.groups,fixed:true};
}

/* ---------- mermaid: packet ---------- */
/** @param {string[]} ls @returns {Graph} */
export function parsePacket(ls){
  let title='',next=0;const f=[];
  for(const line of ls){let m;
    if(m=line.match(/^title\s+(.+)$/)){title=cleanText(m[1]);continue}
    if(m=line.match(/^(\d+)(?:\s*-\s*(\d+))?\s*:\s*(.+)$/)){const a=+m[1],b=m[2]!=null?+m[2]:a;f.push({a,b,label:cleanText(m[3])});next=b+1;continue}
    if(m=line.match(/^\+(\d+)\s*:\s*(.+)$/)){const a=next,b=next+Math.max(1,+m[1])-1;f.push({a,b,label:cleanText(m[2])});next=b+1}
  }
  if(!f.length)throw new Error('No fields found in the packet diagram. Write them like  0-15: "Source Port"');
  const W=32,groups=/** @type {Group[]} */([]),rowIx=/** @type {Map<number,number>} */(new Map()),count=/** @type {Map<number,number>} */(new Map()),mx=Math.max(...f.map(x=>x.b-x.a+1));
  const nodes=f.map((x,i)=>{const r=Math.floor(x.a/W);if(!rowIx.has(r)){groups.push({title:'Bits '+r*W+'–'+(r*W+W-1)});rowIx.set(r,groups.length-1)}
    const k=count.get(r)||0;count.set(r,k+1);const bits=x.b-x.a+1;
    return {id:'f'+(i+1),label:x.label,shape:bits===1?'circle':'box',group:rowIx.get(r)??null,gx:k*DX,gy:(rowIx.get(r)||0)*2.9,hk:bits===1?1:.5+1.5*Math.log2(bits)/Math.log2(Math.max(2,mx)),
      note:(bits===1?'Bit '+x.a:'Bits '+x.a+'–'+x.b)+' ('+bits+' bit'+(bits===1?'':'s')+(bits%8===0?', '+bits/8+' byte'+(bits===8?'':'s'):'')+').'}});
  const B=(/** @type {string} */s)=>'**'+s+'**';
  const steps=f.map((x,i)=>{const bits=x.b-x.a+1,n=nodes[i];
    const auto=bits===1?'Bit '+B(String(x.a))+' is '+B(x.label)+', a single on/off flag.':
      (i===0?'The message starts with ':'Next, bits ')+(i===0?B(x.label)+' in bits '+B(x.a+'–'+x.b):B(x.a+'–'+x.b)+' hold '+B(x.label))+' ('+bits+' bits'+(bits%8===0?', '+bits/8+' byte'+(bits===8?'':'s'):'')+').';
    return {kind:'node',nodes:[n.id],title:x.label,chip:bits+' bit'+(bits===1?'':'s'),auto,tag:groups[/** @type {number} */(n.group)].title}});
  return {type:'packet',nodes,links:[],steps,groups,fixed:true,diagramTitle:title};
}

/* ---------- mermaid: requirement ---------- */
/** @type {Record<string,string>} */
export const REQ_KIND={requirement:'Requirement',functionalrequirement:'Functional requirement',interfacerequirement:'Interface requirement',performancerequirement:'Performance requirement',physicalrequirement:'Physical requirement',designconstraint:'Design constraint'};
/** @type {Record<string,(a:string,b:string)=>string>} */
export const REQ_VERB={satisfies:(a,b)=>a+' meets the requirement '+b,verifies:(a,b)=>a+' checks that '+b+' is met',contains:(a,b)=>a+' includes '+b,copies:(a,b)=>a+' is a copy of '+b,
  derives:(a,b)=>b+' is worked out from '+a,refines:(a,b)=>a+' adds detail to '+b,traces:(a,b)=>a+' traces back to '+b};
/** @param {string[]} ls @returns {Graph} */
export function parseReq(ls){
  const K=graphKit(),B=(/** @type {string} */s)=>'**'+s+'**';
  /** @type {{a:string,v:string,b:string}[]} */ const rels=[];
  /** @type {{n:FxNode,el:boolean,kind:string,f:Record<string,string>}|null} */ let cur=null;
  /** @param {string} s */
  const name=s=>s.trim().replace(/:::[\w-]+$/,'').replace(/^"|"$/g,'');
  for(const line of ls){let m;
    if(cur){if(line==='}'){const f=cur.f,n=cur.n;
        if(cur.el)n.note=[f.type?'Type: '+f.type+'.':'',f.docref?'Document: '+f.docref+'.':''].filter(Boolean).join(' ');
        else{n.note=[(f.id?'ID '+f.id+' · ':'')+cur.kind+'.',f.text?'“'+f.text.replace(/\.$/,'')+'.”':'',f.risk?'Risk: '+f.risk+'.':'',f.verifymethod?'Checked by: '+f.verifymethod+'.':''].filter(Boolean).join(' ');
          if(/high/i.test(f.risk||''))n.icon='❗'}
        cur=null;continue}
      if(m=line.match(/^(\w+)\s*:\s*(.+)$/))cur.f[m[1].toLowerCase()]=cleanText(m[2]);continue}
    if(/^(classDef|class|style|direction|accTitle|accDescr)\b/.test(line))continue;
    if(m=line.match(/^(requirement|functionalRequirement|interfaceRequirement|performanceRequirement|physicalRequirement|designConstraint|element)\s+(.+?)\s*\{$/i)){
      const id=name(m[2]),el=/^element$/i.test(m[1]),n=K.node(id,humanId(id),el?'pill':'box');
      if(el)n.iconFallback='🧩';else n.icon='📋';cur={n,el,kind:REQ_KIND[m[1].toLowerCase()],f:{}};continue}
    if(m=line.match(/^(.+?)\s*-\s*(\w+)\s*->\s*(.+)$/)){rels.push({a:name(m[1]),v:m[2].toLowerCase(),b:name(m[3])});continue}
    if(m=line.match(/^(.+?)\s*<-\s*(\w+)\s*-\s*(.+)$/))rels.push({a:name(m[3]),v:m[2].toLowerCase(),b:name(m[1])});
  }
  if(!K.nodes.size)throw new Error('No requirements found. Write them like  requirement login { text: Users can sign in }');
  const steps=rels.map(r=>{const a=K.nodes.get(r.a)||K.node(r.a,humanId(r.a)),b=K.nodes.get(r.b)||K.node(r.b,humanId(r.b));
    const li=K.link(a,b,{label:r.v,arrow:true}),f=REQ_VERB[r.v];
    return K.edgeStep(li,{chip:r.v,auto:(f?f(B(a.label),B(b.label)):B(a.label)+' '+r.v+' '+B(b.label))+'.'})});
  const N=[...K.nodes.values()];
  if(!steps.length)N.forEach(n=>steps.push(K.nodeStep(n,{auto:B(n.label)+(n.note?': '+n.note:'.')})));
  return {type:'requirement',nodes:N,links:K.links,steps,groups:[]};
}

/* ---------- mermaid: radar ---------- */
/** @param {string[]} ls @returns {Graph} */
export function parseRadar(ls){
  let title='';/** @type {number|null} */ let min=null;/** @type {number|null} */ let max=null;
  /** @type {{id:string,label:string}[]} */ const axes=[];
  /** @type {{id:string,label:string,v:Record<string,number>,vals:(number|null)[]}[]} */ const curves=[];
  /** @param {string} s */
  const label=s=>{const m=s.trim().match(/^([\w-]+)\s*(?:\[\s*"?(.*?)"?\s*\])?$/);return m?{id:m[1],label:cleanText(m[2]||humanId(m[1]))}:{id:s.trim(),label:cleanText(s)}};
  for(const line of ls){let m;
    if(m=line.match(/^title\s+(.+)$/)){title=cleanText(m[1]);continue}
    if(m=line.match(/^axis\s+(.+)$/)){splitArgs(m[1]).filter(Boolean).forEach(a=>axes.push(label(a)));continue}
    if(m=line.match(/^curve\s+(.+?)\s*\{(.*)\}\s*$/)){
      const c=label(m[1]),body=m[2].trim(),v=/** @type {Record<string,number>} */({});
      if(/:/.test(body))splitArgs(body).forEach(p=>{const q=p.match(/^\s*([\w-]+)\s*:\s*(-?[\d.]+)\s*$/);if(q)v[q[1]]=+q[2]});
      else splitArgs(body).map(Number).forEach((x,i)=>{v['#'+i]=x});
      curves.push({...c,v,vals:[]});continue}
    if(m=line.match(/^max\s+(-?[\d.]+)/)){max=+m[1];continue}
    if(m=line.match(/^min\s+(-?[\d.]+)/)){min=+m[1];continue}
  }
  if(!axes.length)throw new Error('No axes found in the radar chart. Write them like  axis a["Speed"], b["Price"]');
  if(!curves.length)throw new Error('No curves found in the radar chart. Write them like  curve x["Team A"]{4, 3, 5}');
  curves.forEach(c=>{c.vals=axes.map((a,i)=>c.v[a.id]!=null?c.v[a.id]:c.v['#'+i]!=null?c.v['#'+i]:null)});
  const all=curves.flatMap(c=>c.vals).filter(isNum),lo=min!=null?min:Math.min(0,...all),hi=max!=null?max:Math.max(...all),span=hi-lo||1;
  const n=axes.length,R0=1.5,R1=5.2,multi=curves.length>1,nodes=/** @type {PlacedNode[]} */([]),links=/** @type {FxLink[]} */([]);
  curves.forEach((c,ci)=>{
    const ids=/** @type {string[]} */([]);
    c.vals.forEach((v,i)=>{if(v==null)return;
      const t=Math.max(0,Math.min(1,(v-lo)/span)),r=R0+(R1-R0)*t,ang=-Math.PI/2+2*Math.PI*i/n+(multi?(ci-(curves.length-1)/2)*.16:0);
      const id='c'+ci+'a'+i;ids.push(id);
      nodes.push({id,label:axes[i].label+' · '+fmtNum(v),shape:'circle',group:multi?ci:null,ci,gx:Math.cos(ang)*r*1.15,gy:Math.sin(ang)*r*1.15,hk:.6+2.4*t,
        note:(multi?c.label+', ':'')+axes[i].label+': '+fmtNum(v)+' (scale '+fmtNum(lo)+'–'+fmtNum(hi)+').'})});
    ids.forEach((id,k)=>{if(ids.length>2||k<ids.length-1)links.push({from:id,to:ids[(k+1)%ids.length],label:'',dotted:false,arrow:false})});
  });
  const by=new Map(nodes.map(x=>[x.id,x]));
  links.forEach(l=>{const a=/** @type {PlacedNode} */(by.get(l.from)),b=/** @type {PlacedNode} */(by.get(l.to)),dx=b.gx-a.gx,dy=b.gy-a.gy,d=Math.hypot(dx,dy)||1,k=Math.min(.55,d/3);
    l.pts=[[a.gx+dx/d*k,a.gy+dy/d*k],[b.gx-dx/d*k,b.gy-dy/d*k]]});
  const B=(/** @type {string} */s)=>'**'+s+'**';
  const steps=/** @type {Step[]} */(axes.map((a,i)=>{
    const ids=/** @type {string[]} */(curves.map((c,ci)=>c.vals[i]!=null?'c'+ci+'a'+i:null).filter(Boolean));
    if(!ids.length)return null;
    let auto;
    if(!multi){const v=/** @type {number} */(curves[0].vals[i]),vs=curves[0].vals.filter(isNum),mx=Math.max(...vs),mn=Math.min(...vs);
      auto=B(a.label)+' scores '+B(fmtNum(v))+(max!=null?' out of '+fmtNum(hi):'')+'.'+(vs.length>2&&v===mx?' This is the strongest point.':vs.length>2&&v===mn?' This is the weakest point.':'');}
    else{const xs=/** @type {{c:{label:string},v:number}[]} */(curves.map(c=>({c,v:c.vals[i]})).filter(x=>x.v!=null)).sort((p,q)=>q.v-p.v);
      auto='On '+B(a.label)+': '+xs.map(x=>x.c.label+' '+B(fmtNum(x.v))).join(', ')+'.'+(xs.length>1&&xs[0].v>xs[1].v?' '+xs[0].c.label+' leads here.':xs.length>1?' A tie at the top.':'');}
    return {kind:'node',nodes:ids,title:a.label,chip:multi?'':fmtNum(/** @type {number} */(curves[0].vals[i])),auto};
  }).filter(s=>s!=null));
  return {type:'radar',nodes,links,steps,groups:multi?curves.map(c=>({title:c.label})):[],fixed:true,noZones:true,diagramTitle:title};
}

/* ---------- mermaid: treemap ---------- */
/** @typedef {{label:string,v:number|null,kids:TreeItem[]}} TreeItem */
/** @param {string} code @returns {Graph} */
export function parseTreemap(code){
  let raw=code.replace(/\r/g,'').split('\n');
  if(raw.find(l=>l.trim())?.trim()==='---'){const a=raw.findIndex(l=>l.trim()==='---'),b=raw.findIndex((l,i)=>i>a&&l.trim()==='---');if(b>a)raw=raw.slice(b+1)}
  raw=raw.map(l=>l.replace(/%%.*$/,'').replace(/\t/g,'    ')).filter(l=>l.trim());
  raw=raw.slice(raw.findIndex(l=>/^\s*treemap(-beta)?\b/.test(l))+1).filter(l=>!/^\s*classDef\b/.test(l));
  /** @type {TreeItem[]} */ const roots=[];
  /** @type {{ind:number,it:TreeItem}[]} */ const stack=[];
  for(const l of raw){
    const ind=(l.match(/^ */)||[''])[0].length,t=l.trim().replace(/:::[\w-]+\s*$/,'').trim();
    const m=t.match(/^("([^"]*)"|'([^']*)'|[^:]+?)\s*(?::\s*(-?[\d.]+))?$/);if(!m)continue;
    /** @type {TreeItem} */
    const it={label:cleanText(m[2]??m[3]??m[1]),v:m[4]!=null?+m[4]:null,kids:[]};
    while(stack.length&&stack[stack.length-1].ind>=ind)stack.pop();
    (stack.length?stack[stack.length-1].it.kids:roots).push(it);stack.push({ind,it});
  }
  if(!roots.length)throw new Error('The treemap is empty. Write sections like  "Section"  and items like  "Item": 12  indented under them.');
  /** @param {TreeItem} it @returns {number} */
  const total=it=>it.kids.length?it.kids.reduce((s,k)=>s+total(k),0):Math.max(0,it.v||0);
  const grand=roots.reduce((s,r)=>s+total(r),0)||1,leafMax=Math.max(1e-9,...(/** @param {TreeItem[]} a @returns {number[]} */ function all(a){return a.flatMap(x=>x.kids.length?all(x.kids):[x.v||0])})(roots));
  /** @param {number} v */
  const pct=v=>{const p=v/grand*100;return (p>=10||Number.isInteger(p)?Math.round(p):Math.round(p*10)/10)+'%'};
  const K=graphKit(),steps=/** @type {Step[]} */([]),B=(/** @type {string} */s)=>'**'+s+'**';
  /** @type {FxNode|null} */ let prev=null;
  let cnt=0;
  roots.forEach((r,i)=>{
    K.groups.push({title:r.label});const g=K.groups.length-1,tot=total(r);
    const h=K.node('t'+(++cnt),r.label+' · '+pct(tot),'box');h.group=g;h.gx=i*DX;h.gy=0;h.ci=i;
    h.hk=r.kids.length?.5:.4+2.2*Math.max(0,r.v||0)/leafMax;h.icon=r.kids.length?'🗂️':'';h.note=fmtNum(tot)+' of '+fmtNum(grand)+' ('+pct(tot)+').';
    let row=1;const members=[h.id];
    /** @param {TreeItem} it @param {FxNode} parent @param {number} depth @returns {void} */
    const walk=(it,parent,depth)=>it.kids.forEach(k=>{
      const t=total(k),n=K.node('t'+(++cnt),(depth>1?'› ':'')+k.label+' · '+fmtNum(t),k.kids.length?'pill':'box');
      n.group=g;n.gx=i*DX+(depth>1?.35*(depth-1):0);n.gy=row++*2.6;n.ci=i;n.hk=k.kids.length?.5:.35+2.3*Math.max(0,k.v||0)/leafMax;
      n.note=fmtNum(t)+' — '+Math.round(t/(total(it)||1)*100)+'% of '+it.label+', '+pct(t)+' of everything.';
      K.link(parent,n,{dotted:true});members.push(n.id);
      if(k.kids.length)walk(k,n,depth+1);
    });
    walk(r,h,1);
    const kids=r.kids.slice().sort((a,b)=>total(b)-total(a));
    const auto=r.kids.length?B(r.label)+' is '+B(pct(tot))+' of the total ('+fmtNum(tot)+'). '+(kids.length===1?'It is all ':'Biggest part: ')+B(kids[0].label)+' ('+fmtNum(total(kids[0]))+')'+(kids.length>2?', then '+andList(kids.slice(1,3).map(x=>x.label),B):kids.length===2?', then '+B(kids[1].label):'')+'.'
      :B(r.label)+' is '+B(pct(tot))+' of the total ('+fmtNum(tot)+').';
    let s;if(prev)s=K.edgeStep(K.link(prev,h,{arrow:true}),{auto,title:r.label,chip:pct(tot)});else{s=K.nodeStep(h,{auto,title:r.label});s.chip=pct(tot)}
    s.nodes=[...(prev?[prev.id]:[]),...members];steps.push(s);prev=h;
  });
  const N=[...K.nodes.values()];routeFixed(N,K.links);
  return {type:'treemap',nodes:N,links:K.links,steps,groups:K.groups,fixed:true};
}

/* ---------- mermaid: zenuml ---------- */
/** @param {string[]} ls @returns {Graph} */
export function parseZen(ls){
  /** @type {Map<string,FxNode>} */ const nodes=new Map();
  /** @type {FxLink[]} */ const links=[];
  /** @type {Map<string,number>} */ const lmap=new Map();
  /** @type {Step[]} */ const steps=[];
  /** @type {Group[]} */ const groups=[];
  /** @type {(string|null)[]} */ const ctx=[];
  /** @type {{node?:FxNode,ctl?:boolean,group?:boolean}[]} */ const calls=[];
  let title='',note='';
  /** @type {FxNode|null} */ let starter=null;
  /** @type {number|null} */ let grp=null;
  const DBRE=/^(database|db|dynamodb|rds|s3|sqs|sns|kafka|redis|elasticache|aurora|mysql|postgres\w*|storage|bucket|queue)$/i;
  /** @param {string} id @param {string} [label] @param {string} [kind] @returns {FxNode} */
  const getNode=(id,label,kind)=>{
    id=id.trim();
    if(!nodes.has(id)){const lb=cleanText(label||humanId(id));nodes.set(id,{id,label:lb,shape:kind==='actor'?'pill':(kind==='db'||/\b(db|database|sql|repo\w*|store|storage|cache|queue)\b|資料庫/i.test(lb)?'cyl':'box'),group:grp,actor:kind==='actor'})}
    return /** @type {FxNode} */(nodes.get(id));
  };
  /** @returns {FxNode} */
  const caller=()=>{for(let i=calls.length-1;i>=0;i--){const c=calls[i].node;if(c)return c}return starter||getNode('__start','Caller','actor')};
  const tag=()=>{for(let i=ctx.length-1;i>=0;i--){const t=ctx[i];if(t)return t}return ''};
  /** @type {Record<string,string>} */
  const WORD={if:'If',else:'Otherwise',while:'While',for:'For each',foreach:'For each',loop:'Repeat',par:'In parallel',opt:'Optional',try:'Try',catch:'If it fails',finally:'Finally',critical:'Critical',section:'',group:''};
  /** @param {FxNode} a @param {FxNode} b @param {string} text @param {{auto?:string,reply?:boolean,async?:boolean}} [o] */
  const msg=(a,b,text,o={})=>{
    if(a===b){steps.push({kind:'node',nodes:[a.id],title:text||a.label,auto:o.auto||'**'+a.label+'** does this on its own.',tag:tag()});return}
    const key=[a.id,b.id].sort().join('\u0001');let li=lmap.get(key);
    if(li==null){li=links.length;lmap.set(key,li);links.push({from:a.id,to:b.id,label:'',dotted:false,arrow:false})}
    steps.push({kind:'edge',link:li,reverse:links[li].from!==a.id,from:a.id,to:b.id,nodes:[a.id,b.id],title:text||(a.label+' → '+b.label),
      auto:o.auto||'**'+a.label+'** '+(o.reply?'replies to':o.async?'sends this to':'asks')+' **'+b.label+'**'+(o.reply||o.async?'.':' to do this.'),tag:tag()});
  };
  /** @param {(n:string)=>void} f */
  const withNote=f=>{const n=note;note='';f(n)};
  for(let line of ls){
    /** @type {RegExpMatchArray|null} */
    let m;
    if(m=line.match(/^\/\/\s*(.*)$/)){note=(note?note+' ':'')+cleanText(m[1].replace(/^`|`$/g,''));continue}
    if(m=line.match(/^title\s+(.+)$/i)){title=cleanText(m[1]);continue}
    if(m=line.match(/^group\s+("?[^{"]*"?)\s*\{\s*$/i)){groups.push({title:cleanText(m[1])||'Group'});grp=groups.length-1;ctx.push(null);calls.push({group:true});continue}
    if(m=line.match(/^@(\w+)\s+(?:<<[^>]*>>\s*)?([\w.]+)(?:\s+as\s+(.+?))?(?:\s+#\w+)?\s*$/)){getNode(m[2],m[3],/^actor$/i.test(m[1])?'actor':DBRE.test(m[1])?'db':'');continue}
    if(m=line.match(/^@Starter\s*\(\s*([\w.]+)\s*\)\s*$/i)){starter=getNode(m[1],undefined,'actor');continue}
    if((m=line.match(/^(?:<<[^>]*>>\s*)?([A-Za-z_][\w]*)(?:\s+as\s+(.+?))?(?:\s+#\w+)?\s*$/))&&!/^(if|else|while|for|forEach|loop|par|opt|try|catch|finally|critical|section|return|end)$/i.test(m[1])){getNode(m[1],m[2]);continue}
    // closing braces (possibly followed by else / catch / finally)
    while(line.startsWith('}')){const top=calls.pop();if(top&&top.group){grp=null;ctx.pop()}else if(top&&top.ctl)ctx.pop();line=line.slice(1).trim()}
    if(!line)continue;
    if(m=line.match(/^(if|else\s+if|else|while|for|forEach|loop|par|opt|try|catch|finally|critical|section)\b\s*(?:\((.*)\))?\s*\{\s*$/i)){
      const k=m[1].toLowerCase().replace(/\s+/g,' '),cond=cleanText(m[2]||'');
      const w=k==='else if'?'Otherwise, if':WORD[k];ctx.push((w?w:'')+(cond?(w?': ':'')+cond:'')||null);calls.push({ctl:true});continue}
    if(m=line.match(/^(?:@return|return)\b\s*(.*)$/i)){
      const real=calls.filter(c=>c.node),me=real[real.length-1],to=real.length>1?real[real.length-2].node:(starter||nodes.get('__start'));
      const rv=cleanText(m[1]),meN=me&&me.node;if(meN&&to)withNote(n=>msg(meN,to,rv?'Returns '+rv:'Done',{reply:true,auto:n||undefined}));continue}
    if(m=line.match(/^([\w.]+)\s*(->|-->)\s*([\w.]+)\s*:\s*(.*)$/)){
      const a=getNode(m[1]),b=getNode(m[3]),txt=cleanText(m[4]);withNote(n=>msg(a,b,txt,{async:true,auto:n||undefined}));continue}
    const open=/\{\s*$/.test(line),body=line.replace(/\{\s*$/,'').trim().replace(/;$/,'');
    if(m=body.match(/^(?:(?:[\w<>[\]]+\s+)?([\w]+)\s*=\s*)?new\s+([\w.]+)\s*\((.*)\)$/)){
      const fromN=caller(),b=getNode(m[2]);
      const withArgs=m[3]?' with '+cleanText(m[3]):'';
      withNote(n=>msg(fromN,b,'Create '+b.label,{auto:n||'**'+fromN.label+'** creates a new **'+b.label+'**'+withArgs+'.'}));
      if(open)calls.push({node:b});continue}
    if(m=body.match(/^(?:(?:[\w<>[\]]+\s+)?([\w]+)\s*=\s*)?(?:([\w]+)\.)?([\w]+)\s*\((.*)\)$/)){
      const fromN=caller(),b=m[2]?getNode(m[2]):fromN,fn=m[3],args=cleanText(m[4]);
      const text=humanId(fn.replace(/([a-z])([A-Z])/g,'$1 $2')).replace(/^./,c=>c.toUpperCase())+(args?' ('+args+')':'');
      withNote(n=>msg(fromN,b,text,{auto:n||undefined}));
      if(open)calls.push({node:b});continue}
  }
  const N=[...nodes.values()];if(!N.length)throw new Error('No participants or messages found in the ZenUML diagram.');
  return {type:'seq',nodes:N,links,steps,groups,diagramTitle:title};
}

/* ---------- layout ---------- */
// 3D blocks are drawn a little closer together than the flat 2D ones
export const IS_3D_PAGE=typeof document!=='undefined'&&document.body.dataset.view==='3d';
export const DX=IS_3D_PAGE?3.0:3.1,DY=IS_3D_PAGE?2.2:2.3,T0=0.56,T1=1.08;
/** Layered layout for graphs without fixed positions: sets gx/gy on nodes and pts on links. @param {FxNode[]} nodes @param {FxLink[]} links */
export function layout(nodes,links){
  const ix=new Map(nodes.map((n,i)=>/** @type {[string,number]} */([n.id,i]))),N=nodes.length,routes=/** @type {Route[]} */([]),rmap=/** @type {Map<string,Route>} */(new Map());
  links.forEach(l=>{
    l.route=null;const a=/** @type {number} */(ix.get(l.from)),b=/** @type {number} */(ix.get(l.to));if(a===b)return;
    const k=a<b?a+'_'+b:b+'_'+a;let r=rmap.get(k);
    if(!r){r={u:a,v:b,fw:false,bw:false,flip:false,a:-1,b:-1,chain:[],pts:[]};rmap.set(k,r);routes.push(r)}
    l.route=r;if(r.u===a)r.fw=true;else r.bw=true;
  });
  const out=Array.from({length:N},()=>/** @type {Route[]} */([]));routes.forEach(r=>out[r.u].push(r));
  const st=new Array(N).fill(0);
  /** @param {number} u @returns {void} */
  const dfs=u=>{st[u]=1;for(const r of out[u]){if(st[r.v]===1)r.flip=true;else if(!st[r.v])dfs(r.v)}st[u]=2};
  for(let i=0;i<N;i++)if(!st[i])dfs(i);
  routes.forEach(r=>{r.a=r.flip?r.v:r.u;r.b=r.flip?r.u:r.v});
  const rank=new Array(N).fill(0),indeg=new Array(N).fill(0),succ=Array.from({length:N},()=>/** @type {number[]} */([]));
  routes.forEach(r=>{succ[r.a].push(r.b);indeg[r.b]++});
  const deg=indeg.slice(),q=/** @type {number[]} */([]);for(let i=0;i<N;i++)if(!deg[i])q.push(i);
  while(q.length){const u=/** @type {number} */(q.shift());for(const v of succ[u]){rank[v]=Math.max(rank[v],rank[u]+1);if(--deg[v]===0)q.push(v)}}
  for(let i=0;i<N;i++)if(!indeg[i]&&succ[i].length)rank[i]=Math.min(...succ[i].map(v=>rank[v]))-1;
  const R=Math.max(...rank)+1,layers=Array.from({length:R},()=>/** @type {LayoutItem[]} */([]));
  const items=nodes.map((n,i)=>/** @type {LayoutItem} */({real:true,i,r:rank[i],up:[],down:[],y:0}));
  items.forEach(it=>layers[it.r].push(it));
  routes.forEach(r=>{
    const chain=[items[r.a]];
    for(let k=rank[r.a]+1;k<rank[r.b];k++){const d=/** @type {LayoutItem} */({real:false,r:k,up:[],down:[],y:0});layers[k].push(d);chain.push(d)}
    chain.push(items[r.b]);
    for(let k=0;k<chain.length-1;k++){chain[k].down.push(chain[k+1]);chain[k+1].up.push(chain[k])}
    r.chain=chain;
  });
  layers.forEach(L=>L.forEach((it,p)=>it.p=p));
  /** @param {LayoutItem[]} a @param {(x:LayoutItem)=>number} f */
  const avg=(a,f)=>a.reduce((s,x)=>s+f(x),0)/a.length;
  for(let t=0;t<14;t++){
    const down=t%2===0;
    for(let k=0;k<R;k++){
      const L=layers[down?k:R-1-k];
      L.forEach(it=>{const ns=down?it.up:it.down;it.bc=ns.length?avg(ns,x=>x.p||0):it.p});
      L.sort((x,y)=>(x.bc||0)-(y.bc||0)||(x.p||0)-(y.p||0));L.forEach((it,p)=>it.p=p);
    }
  }
  layers.forEach(L=>L.forEach((it,p)=>it.y=p-(L.length-1)/2));
  /** @param {LayoutItem} a @param {LayoutItem} b */
  const sep=(a,b)=>(a.real&&b.real)?1:0.6;
  /** @param {LayoutItem[]} L @param {number[]} des */
  const place=(L,des)=>{
    const n=L.length,F=/** @type {number[]} */([]),B=/** @type {number[]} */([]);
    F[0]=des[0];for(let i=1;i<n;i++)F[i]=Math.max(des[i],F[i-1]+sep(L[i-1],L[i]));
    B[n-1]=des[n-1];for(let i=n-2;i>=0;i--)B[i]=Math.min(des[i],B[i+1]-sep(L[i],L[i+1]));
    L.forEach((it,i)=>it.y=(F[i]+B[i])/2);
  };
  for(let t=0;t<12;t++){
    const mode=t>=10?0:t%2;
    for(let k=0;k<R;k++){
      const L=layers[mode===1?R-1-k:k];
      place(L,L.map(it=>{const ns=mode===0?it.up:mode===1?it.down:it.up.concat(it.down);return ns.length?avg(ns,x=>x.y):it.y}));
    }
  }
  nodes.forEach((n,i)=>{n.gx=items[i].r*DX;n.gy=items[i].y*DY});
  routes.forEach(r=>{
    const c=r.chain.map(it=>[it.r*DX,it.y*DY]),pts=[[c[0][0]+T0,c[0][1]]];
    for(let k=0;k<c.length-1;k++){const a=c[k],b=c[k+1];if(Math.abs(a[1]-b[1])>0.02){const xm=(a[0]+b[0])/2;pts.push([xm,a[1]],[xm,b[1]])}}
    const e=c[c.length-1];pts.push([e[0]-T1,e[1]]);r.pts=pts;
  });
  links.forEach(l=>{
    const r=l.route;if(!r){l.pts=null;return}
    const fwd=ix.get(l.from)===r.a,off=(r.fw&&r.bw)?(ix.get(l.from)===r.u?-0.14:0.14):0;
    l.pts=(fwd?r.pts:r.pts.slice().reverse()).map(p=>[p[0],p[1]+off]);
  });
}

/* ---------- diagram styles + settings ---------- */
// Source of truth: diagram-styles/*.json (+ pack.json, diagram-styles.schema.json). Edit a style file, then:
//   npm run styles:sync
// 2D uses bg/bg2, blocks, neutral, ink, edge, accent, shadow, gridOp, sw, opacity; 3D also uses mat, rough, outline, ground, grid3.
// Optional: chips (flat chip look: inset top square + pins), flat (block height factor), labMono / labUpper (plain monospace capital labels).
/** @typedef {{name:string,desc:string,dark?:boolean,bg:string,bg2:string,blocks:string[],neutral:string,ink:string,edge:string,edge3d:string|null,accent:string,accentFg:string,plate:string,plateFg:string,plateBd:string,on:string,onFg:string,muted:string,zone:string,zoneBd:string,chip:string,labShadow:string,shadow:string,gridOp:number,grid3:number,ground:number,mat:string,rough:number,opacity:number,outline:number,sw:number,chips?:boolean,flat?:number,labMono?:boolean,labUpper?:boolean}} DiagramStyle */
/* ---- begin generated STYLES (from diagram-styles/; run: node tools/sync-styles.mjs) ---- */
/** @type {Record<string,DiagramStyle>} */
export const STYLES=/** @type {Record<string,DiagramStyle>} */(JSON.parse("{\"original\":{\"name\":\"Original\",\"desc\":\"Pastel blocks on warm paper\",\"bg\":\"#f5f0e6\",\"bg2\":\"#fbf7ee\",\"blocks\":[\"#a9c8f5\",\"#b6e3b1\",\"#cdbdf6\",\"#f7da8c\",\"#f5b9c5\",\"#f8c59b\",\"#a9e0dc\"],\"neutral\":\"#e6e0d2\",\"ink\":\"#1f2430\",\"edge\":\"#1f2430\",\"edge3d\":null,\"accent\":\"#ee5a3a\",\"accentFg\":\"#fff\",\"plate\":\"#fffdf8\",\"plateFg\":\"#1f2430\",\"plateBd\":\"#1f2430\",\"on\":\"#1f2430\",\"onFg\":\"#f5f0e6\",\"muted\":\"#6b6f7b\",\"zone\":\"rgba(31,36,48,.035)\",\"zoneBd\":\"rgba(31,36,48,.45)\",\"chip\":\"rgba(245,240,230,.75)\",\"labShadow\":\"rgba(31,36,48,.2)\",\"shadow\":\"rgba(31,36,48,.10)\",\"gridOp\":0.07,\"grid3\":0.075,\"ground\":0.2,\"mat\":\"standard\",\"rough\":0.6,\"opacity\":1,\"outline\":0,\"sw\":1},\"teal\":{\"name\":\"Teal\",\"desc\":\"Teal outlines, amber highlight\",\"bg\":\"#f3f8f9\",\"bg2\":\"#ffffff\",\"blocks\":[\"#e6f4f6\",\"#c4e6eb\",\"#9fd5dd\",\"#fff1cc\",\"#d7eef1\",\"#b8e2e8\",\"#e3f2ee\"],\"neutral\":\"#eef2f5\",\"ink\":\"#475569\",\"edge\":\"#007c90\",\"edge3d\":\"#007c90\",\"accent\":\"#fcaf17\",\"accentFg\":\"#1f1300\",\"plate\":\"#ffffff\",\"plateFg\":\"#0f172a\",\"plateBd\":\"#cbd5e1\",\"on\":\"#007c90\",\"onFg\":\"#ffffff\",\"muted\":\"#64748b\",\"zone\":\"rgba(0,124,144,.04)\",\"zoneBd\":\"rgba(0,124,144,.45)\",\"chip\":\"rgba(255,255,255,.85)\",\"labShadow\":\"rgba(15,23,42,.08)\",\"shadow\":\"rgba(15,23,42,.07)\",\"gridOp\":0.06,\"grid3\":0.06,\"ground\":0.1,\"mat\":\"standard\",\"rough\":0.7,\"opacity\":1,\"outline\":0,\"sw\":1},\"line\":{\"name\":\"Line Art\",\"desc\":\"White blocks, bold outlines\",\"bg\":\"#ffffff\",\"bg2\":\"#ffffff\",\"blocks\":[\"#ffffff\"],\"neutral\":\"#ffffff\",\"ink\":\"#0f172a\",\"edge\":\"#0f172a\",\"edge3d\":\"#0f172a\",\"accent\":\"#007c90\",\"accentFg\":\"#fff\",\"plate\":\"#ffffff\",\"plateFg\":\"#0f172a\",\"plateBd\":\"#0f172a\",\"on\":\"#0f172a\",\"onFg\":\"#ffffff\",\"muted\":\"#475569\",\"zone\":\"rgba(15,23,42,.02)\",\"zoneBd\":\"rgba(15,23,42,.5)\",\"chip\":\"rgba(255,255,255,.9)\",\"labShadow\":\"rgba(15,23,42,.15)\",\"shadow\":\"rgba(15,23,42,.06)\",\"gridOp\":0.06,\"grid3\":0.06,\"ground\":0.06,\"mat\":\"toon\",\"rough\":1,\"opacity\":1,\"outline\":0.05,\"sw\":1.5},\"blueprint\":{\"name\":\"Blueprint\",\"desc\":\"Dark background, wireframe\",\"dark\":true,\"bg\":\"#071a2e\",\"bg2\":\"#0b2540\",\"blocks\":[\"#0e3a52\"],\"neutral\":\"#0e3a52\",\"ink\":\"#5eead4\",\"edge\":\"#5eead4\",\"edge3d\":\"#5eead4\",\"accent\":\"#fcaf17\",\"accentFg\":\"#1f1300\",\"plate\":\"rgba(7,26,46,.92)\",\"plateFg\":\"#ccfbf1\",\"plateBd\":\"rgba(94,234,212,.55)\",\"on\":\"#fcaf17\",\"onFg\":\"#1f1300\",\"muted\":\"#7dd3c8\",\"zone\":\"rgba(94,234,212,.05)\",\"zoneBd\":\"rgba(94,234,212,.4)\",\"chip\":\"rgba(7,26,46,.75)\",\"labShadow\":\"rgba(0,0,0,.3)\",\"shadow\":\"rgba(0,0,0,.25)\",\"gridOp\":0.12,\"grid3\":0.12,\"ground\":0,\"mat\":\"basic\",\"rough\":1,\"opacity\":0.45,\"outline\":0,\"sw\":1},\"glass\":{\"name\":\"Glass\",\"desc\":\"See-through blocks\",\"bg\":\"#eef6f8\",\"bg2\":\"#fbfeff\",\"blocks\":[\"#7fc9d3\",\"#9fd5dd\",\"#c4e6eb\",\"#fcd27a\",\"#b8e2e8\",\"#a8dbe3\",\"#d4eef2\"],\"neutral\":\"#d7ecf0\",\"ink\":\"#0f4c5c\",\"edge\":\"#5b9aa6\",\"edge3d\":\"#ffffff\",\"accent\":\"#fcaf17\",\"accentFg\":\"#1f1300\",\"plate\":\"rgba(255,255,255,.85)\",\"plateFg\":\"#0f172a\",\"plateBd\":\"rgba(15,76,92,.3)\",\"on\":\"#007c90\",\"onFg\":\"#ffffff\",\"muted\":\"#3b6f7b\",\"zone\":\"rgba(0,124,144,.05)\",\"zoneBd\":\"rgba(0,124,144,.35)\",\"chip\":\"rgba(255,255,255,.75)\",\"labShadow\":\"rgba(15,23,42,.08)\",\"shadow\":\"rgba(15,76,92,.10)\",\"gridOp\":0.07,\"grid3\":0.07,\"ground\":0.1,\"mat\":\"glass\",\"rough\":0.15,\"opacity\":0.6,\"outline\":0,\"sw\":1},\"circuit\":{\"name\":\"Circuit\",\"desc\":\"Dark board, flat chips, thin blue lines\",\"dark\":true,\"bg\":\"#080c17\",\"bg2\":\"#0e1527\",\"blocks\":[\"#1a2438\",\"#1b2a42\",\"#172236\"],\"neutral\":\"#1a2438\",\"ink\":\"#4d6a90\",\"edge\":\"#7393bd\",\"edge3d\":\"#86a6d0\",\"accent\":\"#bfe1ff\",\"accentFg\":\"#0a0e1a\",\"plate\":\"transparent\",\"plateFg\":\"#c9d6e8\",\"plateBd\":\"transparent\",\"on\":\"rgba(191,225,255,.12)\",\"onFg\":\"#ffffff\",\"muted\":\"#8094ae\",\"zone\":\"rgba(115,147,189,.05)\",\"zoneBd\":\"rgba(115,147,189,.35)\",\"chip\":\"rgba(8,12,23,.7)\",\"labShadow\":\"transparent\",\"shadow\":\"rgba(0,0,0,.35)\",\"gridOp\":0.11,\"grid3\":0.11,\"ground\":0,\"mat\":\"basic\",\"rough\":1,\"opacity\":1,\"outline\":0,\"sw\":0.8,\"chips\":true,\"flat\":0.42,\"labMono\":true,\"labUpper\":true}}"));
/* ---- end generated STYLES ---- */
export let DS=STYLES.original,DSK='original';
export const UI_ICON={check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',chev:'<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>'};
export const hashStyle=()=>{const m=location.hash.match(/[#&]s=([\w-]+)/);return m&&STYLES[m[1]]?m[1]:null};
/** @param {string|null} k */
export function useStyle(k){
  DSK=k&&STYLES[k]?k:'original';DS=STYLES[DSK];const s=DS,r=document.documentElement.style;
  Object.entries({'--d-bg':s.bg,'--d-bg2':s.bg2,'--d-ink':s.ink,'--d-accent':s.accent,'--d-accent-fg':s.accentFg,'--d-plate':s.plate,'--d-plate-fg':s.plateFg,'--d-plate-bd':s.plateBd,
    '--d-on':s.on,'--d-on-fg':s.onFg,'--d-muted':s.muted,'--d-zone':s.zone,'--d-zone-bd':s.zoneBd,'--d-chip':s.chip,'--d-lab-shadow':s.labShadow,'--d-lab':s.labMono?'var(--d-mono)':'var(--d-sans)'}).forEach(([p,v])=>r.setProperty(p,v));
  document.body.classList.toggle('d-dark',!!s.dark);
  document.querySelectorAll('#arr path').forEach(p=>p.setAttribute('fill',s.ink));
  document.querySelectorAll('#arrA path').forEach(p=>p.setAttribute('fill',s.accent));
  /** @type {NodeListOf<HTMLElement>} */(document.querySelectorAll('#styleSel .opt')).forEach(b=>{const on=b.dataset.s===DSK;b.classList.toggle('on',on);b.setAttribute('aria-checked',String(on))});
}
/** @param {string} k */
export function setStyle(k){
  if(!STYLES[k]||k===DSK)return;useStyle(k);
  try{localStorage.setItem('flowx.style',k)}catch(e){}
  if(/[#&]s=/.test(location.hash))history.replaceState(null,'',location.pathname+location.search+location.hash.replace(/([#&])s=[\w-]+/,'$1s='+k));
  if(page.S.scene)page.restyle();
}
export function initStyle(){let k=hashStyle();if(!k)try{k=localStorage.getItem('flowx.style')}catch(e){}useStyle(k);
  const hi=location.hash.match(/[#&]i=([01])/);let ic=hi?hi[1]:null;if(ic==null)try{ic=localStorage.getItem('flowx.icons')}catch(e){}ICONS_ON=ic!=='0'}
// emoji icons on the blocks: on by default; saved in the browser and carried in client links as &i=0
export let ICONS_ON=true;
/** @param {boolean} on */
export function setIcons(on){
  if(on===ICONS_ON)return;ICONS_ON=on;markIcons();
  try{localStorage.setItem('flowx.icons',on?'1':'0')}catch(e){}
  if(/[#&]i=/.test(location.hash))history.replaceState(null,'',location.pathname+location.search+location.hash.replace(/([#&])i=[01]/,'$1i='+(on?1:0)));
  if(page.S.scene)page.restyle();
}
export const markIcons=()=>/** @type {NodeListOf<HTMLElement>} */(document.querySelectorAll('#iconSel button')).forEach(b=>b.classList.toggle('on',(b.dataset.i==='1')===ICONS_ON));
export function buildSettings(){
  $('#styleSel').innerHTML=Object.entries(STYLES).map(([k,s])=>'<button class="opt" role="radio" data-s="'+k+'"><span class="radio"></span><span class="ot"><b>'+esc(s.name)+(k==='original'?' <em>Default</em>':'')+'</b><small>'+esc(s.desc)+'</small></span><span class="sw">'
    +[s.bg,...s.blocks.slice(0,3),s.edge,s.accent].map(c=>'<i style="background:'+c+'"></i>').join('')+'</span></button>').join('');
  $('#viewSel').querySelectorAll('button').forEach((/** @type {HTMLElement} */b)=>b.classList.toggle('on',b.dataset.v===document.body.dataset.view));
  useStyle(DSK);
}
/** @param {string|null} name */
export function openPop(name){
  [['set',$('#settings')],['share',$('#share')]].forEach(([k,el])=>el.classList.toggle('open',k===name));
  $('#btnSet').classList.toggle('on',name==='set');$('#btnSet').setAttribute('aria-expanded',String(name==='set'));
  $('#popScrim').classList.toggle('open',!!name);
}
export const popOpen=()=>!!document.querySelector('.pop.open');
export const isEmbed=()=>/(?:^|\/)embed(?:\/|$)/.test(location.pathname)||/(?:^|[?&])embed(?:=1)?(?:&|$)/.test(location.search);
export const is3dView=()=>document.body.dataset.view==='3d';
/** GitHub Pages / opening *.html / file:// — no Node rewrite for `/embed` or asset paths under `/3d/`. */
export const isStaticHost=()=>/\.github\.io$/i.test(location.hostname)||/\.html$/.test(location.pathname)||location.protocol==='file:';
export function appBase(){
  let p=location.pathname;
  p=p.replace(/\/(?:index|3d)\.html$/,'');
  p=p.replace(/\/embed(?:\/3d)?\/?$/,'');
  p=p.replace(/\/3d\/?$/,'');
  return p.replace(/\/$/,'')||'';
}
export const rootUrl=()=>location.origin+appBase();
/** @param {string} u */
export const tidyUrl=u=>u.replace(/([^:]\/)\/+/g,'$1');
/** Page URL without a trailing slash: `/3d/` would break relative asset URLs and is a 404 on static hosts. @param {string} sub */
export const pageUrl=sub=>sub?tidyUrl(rootUrl()+sub):tidyUrl(rootUrl()+'/');
/** @param {'2d'|'3d'} dim @param {boolean} [embed] */
export const staticPage=(dim,embed)=>tidyUrl(rootUrl()+'/'+(dim==='3d'?'3d.html':'index.html'))+(embed?'?embed=1':'');
export const linkOpts=()=>(DSK!=='original'?'&s='+DSK:'')+(ICONS_ON?'':'&i=0');
export const clientLink=async()=>(isStaticHost()?staticPage(is3dView()?'3d':'2d'):pageUrl(is3dView()?'/3d':''))+'#c='+await page.encode(/** @type {any} */(page.S).md)+linkOpts();
/**
 * Turn a pasted GitHub blob URL into a raw URL browsers can fetch.
 * @param {string} raw
 * @returns {string}
 */
export function normalizeMdUrl(raw){
  let u;
  try{u=new URL(String(raw||'').trim())}catch(e){throw new Error('That does not look like a URL.',{cause:e})}
  if(u.protocol!=='http:'&&u.protocol!=='https:')throw new Error('Only http(s) URLs are allowed.');
  if(/^(www\.)?github\.com$/i.test(u.hostname)){
    const m=u.pathname.match(/^\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/);
    if(m)return 'https://raw.githubusercontent.com/'+m[1]+'/'+m[2]+'/'+m[3]+'/'+m[4]+u.search;
  }
  return u.href;
}
/**
 * Fetch markdown text from a public URL (browser CORS applies).
 * @param {string} raw
 * @returns {Promise<string>}
 */
export async function fetchMarkdown(raw){
  const href=normalizeMdUrl(raw);
  let res;
  try{res=await fetch(href,{mode:'cors',credentials:'omit',redirect:'follow'})}
  catch(e){throw new Error('Could not fetch that URL (network or CORS). Use a public raw URL, paste the file, or share a #c= client link.',{cause:e})}
  if(!res.ok)throw new Error('Fetch failed ('+res.status+' '+res.statusText+'). Check the URL is public.');
  const text=await res.text();
  if(text.length>1500000)throw new Error('File is too large (max about 1.5 MB).');
  if(!text.trim())throw new Error('That URL returned an empty file.');
  return text;
}
/** Shareable hash that reloads markdown from a URL on open. @param {string} url */
export const urlLink=url=>(isStaticHost()?staticPage(is3dView()?'3d':'2d'):pageUrl(is3dView()?'/3d':''))+'#u='+encodeURIComponent(normalizeMdUrl(url))+linkOpts();
/**
 * iframe HTML for pasting into a website, like YouTube's "Embed" code.
 * @param {string} url  the /embed link (with #c=…)
 * @param {string} size 'r' for responsive (full width, 16:10), or 'WxH' in pixels
 * @param {string} [title]
 * @returns {string}
 */
export function embedCode(url,size,title){
  const a=(/** @type {string} */v)=>v.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
  const attrs='src="'+a(url)+'" title="'+a(title||'Flow Explainer')+'" loading="lazy" allow="fullscreen; clipboard-write" allowfullscreen';
  const m=size.match(/^(\d+)x(\d+)$/);
  if(m)return '<iframe '+attrs+' width="'+m[1]+'" height="'+m[2]+'" style="border:0;border-radius:12px;max-width:100%"></iframe>';
  return '<div style="position:relative;width:100%;aspect-ratio:16/10">\n  <iframe '+attrs+' style="position:absolute;inset:0;width:100%;height:100%;border:0;border-radius:12px"></iframe>\n</div>';
}
/**
 * Standalone script-tag embed (loads public `embed.js`, which injects an iframe).
 * @param {string} c  compressed #c= payload (no prefix)
 * @param {{text:boolean,switchView:boolean,view:'2d'|'3d',scriptSrc:string,size:string,title?:string,style?:string,icons?:boolean}} o
 * @returns {string}
 */
export function embedScript(c,o){
  const a=(/** @type {string} */v)=>v.replace(/&/g,'&amp;').replace(/"/g,'&quot;');
  let t='<script async src="'+a(o.scriptSrc)+'" data-c="'+a(c)+'" data-view="'+(o.view==='3d'?'3d':'2d')+'" data-text="'+(o.text?'1':'0')+'"';
  if(!o.switchView)t+=' data-switch="0"';
  if(o.style&&o.style!=='original')t+=' data-s="'+a(o.style)+'"';
  if(o.icons===false)t+=' data-i="0"';
  if(o.size&&o.size!=='r')t+=' data-size="'+a(o.size)+'"';
  if(o.title)t+=' data-title="'+a(o.title)+'"';
  return t+'></'+'script>';
}
/**
 * Embed-only options carried in the link: &t=0 hides the step text panel, &v=0 locks the view.
 * @param {{text:boolean,switchView:boolean}} o
 */
export const embedOpts=o=>(o.text?'':'&t=0')+(o.switchView?'':'&v=0');
/** @param {string} k @returns {string|null} value of k in the URL hash (#c=…&k=v) */
export const hashParam=k=>{const m=location.hash.match(new RegExp('[#&]'+k+'=([^&]*)'));return m?m[1]:null};
/** In the embed player, apply &t=0 / &v=0 from the link. */
export function applyEmbedOpts(){if(!isEmbed())return;document.body.classList.toggle('no-text',hashParam('t')==='0');document.body.classList.toggle('lock-view',hashParam('v')==='0')}
export const embedLink=async(/** @type {{text:boolean,switchView:boolean}} */o={text:true,switchView:true})=>(isStaticHost()?staticPage(is3dView()?'3d':'2d',true):pageUrl('/embed'+(is3dView()?'/3d':'')))+'#c='+await page.encode(/** @type {any} */(page.S).md)+linkOpts()+embedOpts(o);
/** @param {'2d'|'3d'} dim */
export function viewHref(dim){
  const h=location.hash||'';
  if(isStaticHost()) return staticPage(dim,isEmbed())+h;
  if(isEmbed()) return pageUrl('/embed'+(dim==='3d'?'/3d':''))+h;
  return pageUrl(dim==='3d'?'/3d':'')+h;
}
/** UI state kept on S by this block. */
export const uiState=()=>/** @type {{stepsOpen?:boolean|null}} */(/** @type {unknown} */(page.S));
/** @param {Event} e */
export const tgt=e=>/** @type {HTMLElement} */(e.target);
/** @param {Graph} g @param {number} i @returns {string} */
export function stepsHtml(g,i){
  const n=g.steps.length,by=(/** @type {string|undefined} */id)=>g.nodes.find(x=>x.id===id),U=uiState();
  if(U.stepsOpen==null)U.stepsOpen=!matchMedia('(max-width:820px)').matches;
  const rows=g.steps.map((s,k)=>{
    const st=k+1<i?'done':k+1===i?'on':'up',ed=s.kind==='edge',a=ed?by(s.from):null,b=ed?by(s.to):null,l=ed&&s.link!=null?g.links[s.link]:null;
    const sub=a&&b?a.label+' → '+b.label:(s.nodes||[]).map(id=>by(id)?.label).filter(Boolean).join(', ');
    const lb=l&&l.label&&l.label.length<=14&&l.label!==s.title?l.label:'',yes=/^(yes|y|true|ok|success|pass(ed)?|approved?|valid)$/i.test(lb),no=/^(no|n|false|fail(ed)?|error|reject(ed)?|denied|invalid)$/i.test(lb);
    const tag=lb&&(yes||no||(a&&a.shape==='hex'))?'<span class="tag'+(yes?' yes':no?' no':'')+'">if '+esc(lb)+'</span>':'';
    return '<li class="'+st+'" data-s="'+(k+1)+'" tabindex="0" role="button"'+(st==='on'?' aria-current="step"':'')+'><span class="mk">'+(st==='done'?UI_ICON.check:k+1)+'</span><span class="bd"><span class="t"><span class="tt">'+esc(s.title)+'</span>'+tag+(st==='on'?'<span class="now">Now</span>':'')+'</span>'
      +(sub&&sub!==s.title?'<span class="ft">'+esc(sub)+'</span>':'')+'</span></li>';
  }).join('');
  return '<details class="steps"'+(U.stepsOpen?' open':'')+'><summary><span class="h">All steps</span><span class="cnt">'+(i?'Step '+i+' of '+n:n+' step'+(n===1?'':'s'))+'</span>'+UI_ICON.chev+'</summary>'
    +'<div class="prog"><i style="width:'+(n?Math.round(i/n*100):0)+'%"></i></div><ol class="stepper">'+rows+'</ol></details>';
}
export function wireUi(){
  applyEmbedOpts();
  buildSettings();
  $('#btnSet').onclick=(/** @type {MouseEvent} */e)=>{e.stopPropagation();openPop($('#settings').classList.contains('open')?null:'set')};
  $('#setClose').onclick=$('#shareClose').onclick=$('#popScrim').onclick=()=>openPop(null);
  $('#styleSel').onclick=(/** @type {MouseEvent} */e)=>{const b=/** @type {HTMLElement|null} */(tgt(e).closest('.opt'));if(b)setStyle(b.dataset.s||'')};
  markIcons();$('#iconSel').onclick=(/** @type {MouseEvent} */e)=>{const b=/** @type {HTMLElement|null} */(tgt(e).closest('button'));if(b)setIcons(b.dataset.i==='1')};
  $('#viewSel').onclick=(/** @type {MouseEvent} */e)=>{const b=/** @type {HTMLElement|null} */(tgt(e).closest('button'));if(b&&b.dataset.v!==document.body.dataset.view)$('#btnMode').click()};
  $('#btnShare').onclick=async()=>{
    const url=await clientLink();let ok=true;
    try{await navigator.clipboard.writeText(url)}catch(e){ok=false}
    $('#shareUrl').value=url;$('#shareTitle span').textContent=ok?'Client link copied':'Copy this client link';openPop('share');
    await fillEmbed();
    if(!ok){$('#shareUrl').focus();$('#shareUrl').select()}
  };
  $('#shareCopy').onclick=async()=>{try{await navigator.clipboard.writeText($('#shareUrl').value);page.toast('Client link copied')}catch(e){$('#shareUrl').select()}};
  /** Fill the embed box from the current diagram, view, format and size. */
  const fillEmbed=async()=>{
    const doc=/** @type {{doc?:{docTitle?:string}|null}} */(/** @type {unknown} */(page.S)).doc;
    const title=(doc&&doc.docTitle)||'Flow Explainer',opts=curOpts(),size=$('#embedSize').value;
    if($('#embedKind').value==='script'){
      const c=await page.encode(/** @type {any} */(page.S).md);
      $('#embedCode').value=embedScript(c,{text:opts.text,switchView:opts.switchView,view:is3dView()?'3d':'2d',scriptSrc:pageUrl('/embed.js'),size,title,style:DSK,icons:ICONS_ON});
    }else $('#embedCode').value=embedCode(await embedLink(opts),size,title);
  };
  const curOpts=()=>({text:$('#embedText').checked,switchView:$('#embedSwitch').checked});
  $('#embedKind').onchange=$('#embedSize').onchange=$('#embedText').onchange=$('#embedSwitch').onchange=fillEmbed;
  $('#embedCopy').onclick=async()=>{try{await navigator.clipboard.writeText($('#embedCode').value);page.toast($('#embedKind').value==='script'?'Script tag copied':'Embed code copied')}catch(e){$('#embedCode').select()}};
  $('#shareEmbed').onclick=async()=>{
    const url=await embedLink(curOpts());
    try{await navigator.clipboard.writeText(url);page.toast('Embed link copied')}catch(e){prompt('Copy this embed link',url)}
  };
  $('#panel').addEventListener('keydown',(/** @type {KeyboardEvent} */e)=>{const t=tgt(e),li=/** @type {HTMLElement|null} */(t.closest&&t.closest('.stepper li'));if(li&&(e.key==='Enter'||e.key===' ')){e.preventDefault();e.stopPropagation();page.go(+(li.dataset.s||0))}});
  const ab=$('#about'),about=(/** @type {boolean} */o)=>{ab.classList.toggle('open',o);if(o){openPop(null);/** @type {HTMLElement} */(ab.querySelector('.about-card')).scrollTop=0;$('#aboutClose').focus({preventScroll:true})}};
  $('#btnAbout').onclick=()=>about(true);$('#aboutClose').onclick=()=>about(false);ab.onclick=(/** @type {MouseEvent} */e)=>{if(e.target===ab)about(false)};
  /** @type {NodeListOf<HTMLElement>} */(document.querySelectorAll('[data-about]')).forEach(a=>a.onclick=(/** @type {MouseEvent} */e)=>{e.preventDefault();about(true)});
  // New: empty editor with a starter template one click away; Examples: load a sample straight from the header
  const TPL=$('#tplNew').textContent.trim()+'\n';
  $('#btnNew').onclick=()=>{page.drawer(true);$('#src').value='';$('#src').placeholder=TPL;$('#drawerTitle').textContent='New walkthrough';page.showErr('');$('#src').focus()};
  $('#btnTpl').onclick=()=>{$('#src').value=TPL;$('#src').focus()};
  $('#btnEdit').addEventListener('click',()=>{$('#drawerTitle').textContent='Paste your markdown';$('#src').placeholder=''});
  const ex2=$('#exHead');ex2.innerHTML=$('#exSel').innerHTML.replace('Load example…','Examples');
  ex2.onchange=(/** @type {Event} */e)=>{const t=/** @type {HTMLSelectElement} */(e.target),v=t.value;if(v){$('#src').value=$('#'+v).textContent.trim()+'\n';t.value='';page.tryRender()}};
  $('#panel').addEventListener('toggle',(/** @type {Event} */e)=>{const t=/** @type {HTMLDetailsElement} */(e.target);if(t.matches&&t.matches('details.steps'))uiState().stepsOpen=t.open},true);
}

/* ---------- end of diagram styles + settings ---------- */
