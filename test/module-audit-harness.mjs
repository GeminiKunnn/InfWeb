// Audit: concatenate the three modules (stripping ESM syntax) into a single
// CommonJS-style scope, then append an audit harness that fills a character and
// prints every computed value. Run: node test/module-audit-harness.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const js = path.join(__dirname, '..', 'src', 'js');

function load(name) {
  let code = fs.readFileSync(path.join(js, name + '.js'), 'utf8');
  code = code.replace(/import\s+[\s\S]*?from\s*['"][^'"]+['"]\s*;?/g, '');
  code = code.replace(/export\s+\{[^}]*\}\s*;?/g, '');
  code = code.replace(/export\s+/g, '');
  return code;
}

let moduleSource = [load('character-config'), load('store'), load('app')].join('\n');

// Remove boot invocation path so nothing runs on load
moduleSource = moduleSource.replace(/if\s*\(document\.readyState[\s\S]*$/, '');

const AUDIT = `
(function audit(){
  const out = [];
  const line = (s) => out.push(s);

  // ---- Baseline character: all attrs base 2, skills base 0, all bonuses 0 ----
  let ch = emptyCharacter();
  character = ch; // app-level character reference

  function setAttrs(spec){ Object.entries(spec).forEach(([id, obj])=>{ if(obj.base!==undefined) character.attributes[id].base=obj.base; }); }

  line('== BASELINE (attrs=2, skills=0) ==');
  line('attrValue(strength)='+attrValue('strength')+' legendary='+attrLegendary('strength'));
  line('derived: ' + JSON.stringify(derivedValues()));
  line('skillExtraSuccess(weaponry)='+skillExtraSuccess('weaponry'));
  line('attackCheckDP(brawl preset)='+attackCheckDP({attr:'strength',skill:'brawl',weaponDamage:0,specialty:0,bonuses:[0,0,0,0]}));
  line('spellBaseDP='+spellBaseDP());
  const spl = {potency:0,cost:0,specialty:0,bonuses:[0,0,0,0,0,0],dmgBonuses:[0,0,0]};
  line('spellCheckDP='+spellCheckDP(spl)+' spellDamageCap='+spellDamageCap(spl));
  line('energyTotal(single attr, no bonus)='+energyTotal({attr1:'intelligence',attr2:'',bonuses:[0,0,0]}));
  line('perkAllocation (tier1..3 each once)='+ (ch.perks.push({tier:1},{tier:2},{tier:3}), perkAllocation()));
  ch.perks=[];
  line('overviewArmorTotal='+overviewArmorTotal()+' armorExtraSuccess='+armorExtraSuccess());
  line('reductionSummary='+reductionSummary());

  // ---- A leveled test: push attrs/skills to trigger legendary & extras ----
  ch = emptyCharacter(); character = ch;
  ch.attributes.strength.base = 6;  // value 6 -> legendary (6-1)/5=1
  ch.attributes.dexterity.base = 11; // legendary (11-1)/5=2
  ch.attributes.intelligence.base = 16; // legendary 3
  ch.attributes.composure.base = 7;  // composure legendary 1  (for gene lock & willpower uses presence=沉着)
  ch.attributes.resolve.base = 7;    // resolve legendary 1
  ch.attributes.perception.base = 21; // legendary 4
  ch.attributes.stamina.base = 2;
  ch.skills.weaponry.base = 5;  // extra success 1
  ch.skills.athletics.base = 7; // extra success 2
  ch.skills.brawl.base = 0;
  ch.skills.occult.base = 0;

  line('');
  line('== LEV LCD (mixed) ==');
  line('derived: ' + JSON.stringify(derivedValues()));
  line('legendaries S='+attrLegendary('strength')+' D='+attrLegendary('dexterity')+' I='+attrLegendary('intelligence')+' CO='+attrLegendary('composure')+' R='+attrLegendary('resolve')+' P='+attrLegendary('perception'));
  line('skillExtraSuccess weaponry='+skillExtraSuccess('weaponry')+' athletics='+skillExtraSuccess('athletics'));
  line('sensRange total=' + (attrValue('perception')*10 + attrLegendary('perception')*20));
  line('geneLock(composure) min(base+legendary,10) with base0 = '+ Math.min((0)+attrLegendary('composure'),10));
  line('armorExtraSuccess(stamina leg)= '+attrLegendary('stamina'));

  // ---- attr split: 属性值(基础+内修) vs 检定值(+内2+械完它+它2)；传奇按属性值 ----
  ch.attributes.dexterity.gear = 3;   // dex base11 -> pool 11, 检定值 14
  line('attrSplit dex pool='+attrPool('dexterity')+' value='+attrValue('dexterity')+' leg='+attrLegendary('dexterity'));
  line('  expect pool=11 value=11+inner2 0+3=14 leg=((11-1)/5)=2');
  ch.attributes.dexterity.gear = 0;

  // ---- Base attacks: verify each DP & cap against expected ----
  ch.baseAttacks.forEach((atk)=>{
    const d = baseAttackData(atk);
    line('atk '+atk.id+' label='+atk.label+' checkDP='+d.checkDP+' damageCap='+d.damageCap+' extraSuccess='+d.extraSuccess);
  });

  // ---- F3 willpower: 沉着(presence) legendary must add to willpower ----
  ch = emptyCharacter(); character = ch;
  ch.attributes.presence.base = 7;   // 沉着 -> legendary 1
  ch.attributes.resolve.base = 7;    // 决心 -> legendary 1
  line('');
  line('== F3 willpower (沉着=7 leg1, 决心=7 leg1) ==');
  line('legendary presence='+attrLegendary('presence')+' resolve='+attrLegendary('resolve'));
  line('willpower = ' + derivedValues().willpower + ' (expect 7+7+3+1=18)');
  line('initiative = ' + derivedValues().initiative + ' (expect 7+2+3=12)');

  // ---- F2/F5 saves: verify saveTotalOf (n, 不含附加成功) 与 saveDisplayOf (n+m) ----
  const dd = character.derivedDetail;
  dd.saves.special = [1, 0, 0]; dd.saves.feat = [2, 0, 0]; dd.saves.bonus = [0,1,2,3,0,0, 0,0,0,0,0,0, 0,0,0,0,0,0]; // save0 加成[0..5], save1 加成[6..11]
  line('saveTotalOf(0)=' + saveTotalOf(0));
  line('saveTotalOf(1)=' + saveTotalOf(1) + ' willSave base=' + derivedValues().willSave);
  line('saveExtraSuccess(1)=' + saveExtraSuccess(1));
  line('saveDisplayOf(1)=' + saveDisplayOf(1));
  line('SAVE_DEFS[1]=' + JSON.stringify(SAVE_DEFS[1]));

  // save0(反射)：n 用加成[0..2]=0+1+2=3 => 新角色 dex2+ath0+leg0*3 + special1 + feat2 + 3 = 8
  line('  expect saveTotalOf(0)=8 = 2+0+0+1+2+3');
  // save0 m = 技能附加0 + 传奇0 + 加成[3..5]=3+0+0=3 => 3
  line('  expect saveTotalOf(0)=8；saveExtraSuccess(0)=3；saveDisplayOf(0)=8+3');
  // save1(意志)：resolve7+empathy0+传奇决心×3 + spec0 + feat0 + 加成[6..8]0 => 10；m=1
  line('  expect saveTotalOf(1)=10 = 7+0+3+0+0+0；saveExtraSuccess(1)=1；saveDisplayOf(1)=10+1');

  console.log(out.join('\\n'));
  return out.join('\\n');
})();
`;

const nodeProto = Object.create(null);
nodeProto.appendChild = function () { return this; };
nodeProto.addEventListener = function () {};
const mkEl = () => ({
  dataset: {}, classList: { toggle(){}, add(){}, remove(){}, contains(){return false;} },
  closest(){return null;}, querySelector(){return null;}, querySelectorAll(){return [];},
  style: {}, setAttribute(){}, appendChild(){}, addEventListener(){},
});
const sandbox = {
  console, Math, Number, String, Array, Object, JSON, Date,
  document: {
    readyState: 'loading',
    createElement: mkEl, createTextNode: () => mkEl(),
    addEventListener(){}, querySelector(){return null;}, querySelectorAll(){return [];},
    getElementById(){return mkEl();}, body:{appendChild(){}},
  },
  localStorage: { getItem(){return null;}, setItem(){}, removeItem(){} },
  setTimeout, clearTimeout,
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(moduleSource + AUDIT, sandbox);