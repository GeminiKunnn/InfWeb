<script setup>
// 轮回之境 · TRPG 战斗界面（纯 UI 展示；交互仅做视觉展示效果，无计算/数据逻辑）。
// 布局：Header + 舞台列(左栏+中央+底部槽位) / 右侧栏(整高)；底部槽位横跨到右栏左侧停下。
// 点击敌对/玩家 Token 时，顶部目标栏会随选中的单位切换展示（纯展示数据）。

import { ref } from 'vue';
import { useApp } from '../composables/useApp';

const { go } = useApp();

const party = ref([
  { icon: '🧙', name: '白夜荧', cls: '圣女 Lv.6', hpPct: 88, mp: 4, mpMax: 5, flag: 'def', active: true },
  { icon: '🗡️', name: '陆寒舟', cls: '剑豪 Lv.7', hpPct: 62, mp: 2, mpMax: 4, flag: 'atk', active: false },
  { icon: '🛡️', name: '阿黛尔', cls: '重装骑士 Lv.6', hpPct: 100, mp: 3, mpMax: 3, flag: 'def', active: false },
  { icon: '🔥', name: '乱星河', cls: '咒术师 Lv.7', hpPct: 41, mp: 4, mpMax: 5, flag: 'atk', active: false },
]);
function selectParty(i) {
  party.value.forEach((m, idx) => { m.active = idx === i; });
}

const turnOrder = ref([
  { idx: 1, name: '白夜荧', flag: '友', current: true },
  { idx: 2, name: '饥饿巨犬', flag: '敌', current: false },
  { idx: 3, name: '陆寒舟', flag: '友', current: false },
  { idx: 4, name: '穴居魔蛛 x2', flag: '敌', current: false },
  { idx: 5, name: '阿黛尔', flag: '友', current: false },
  { idx: 6, name: '乱星河', flag: '友', current: false },
  { idx: 8, name: '熔岩地精', flag: '敌', current: false },
  { idx: 9, name: '暗影信徒', flag: '敌', current: false },
]);

const enemyPills = ref([
  { name: '饥饿巨犬', hp: 22, focused: false },
  { name: '穴居魔蛛', hp: 8, focused: true },
  { name: '熔岩地精', hp: 14, focused: false },
]);
function focusEnemy(i) {
  enemyPills.value.forEach((p, idx) => { p.focused = idx === i; });
}

// 地图 Token；每个单位带展示用属性，用于点击后切换顶部目标栏
const tokens = ref([
  { x: 26, y: 52, kind: 'player', round: true, icon: '🧙', name: '白夜荧', st: '防', selected: true,
    hpPct: 88, stats: [['物防', '12'], ['魔防', '16'], ['速度', '11'], ['晕抗', '4']] },
  { x: 34, y: 68, kind: 'player', round: true, icon: '🗡️', name: '陆寒舟', st: '攻',
    hpPct: 62, stats: [['物防', '9'], ['魔防', '8'], ['速度', '14'], ['晕抗', '2']] },
  { x: 42, y: 44, kind: 'player', round: true, icon: '🛡️', name: '阿黛尔', st: '防',
    hpPct: 100, stats: [['物防', '20'], ['魔防', '13'], ['速度', '6'], ['晕抗', '5']] },
  { x: 30, y: 80, kind: 'player', round: true, icon: '🔥', name: '乱星河', st: '攻',
    hpPct: 41, stats: [['物防', '8'], ['魔防', '18'], ['速度', '10'], ['晕抗', '3']] },
  // 敌方（怪物 Token，带血条数字 + 顶栏展示属性）
  { x: 70, y: 40, kind: 'enemy', icon: '🐺', name: '饥饿巨犬', hp: 22,
    hpPct: 55, stats: [['物防', '10'], ['魔防', '6'], ['速度', '12'], ['晕抗', '2']] },
  { x: 64, y: 58, kind: 'enemy', round: true, icon: '🕷️', name: '穴居魔蛛', hp: 8,
    hpPct: 22, stats: [['物防', '8'], ['魔防', '9'], ['速度', '13'], ['晕抗', '1']] },
  { x: 76, y: 62, kind: 'enemy', icon: '🦎', name: '熔岩地精', hp: 14,
    hpPct: 64, stats: [['物防', '14'], ['魔防', '10'], ['速度', '9'], ['晕抗', '3']] },
  { x: 82, y: 32, kind: 'enemy', icon: '👤', name: '暗影信徒', hp: 28,
    hpPct: 78, stats: [['物防', '8'], ['魔防', '17'], ['速度', '8'], ['晕抗', '4']] },
  { x: 68, y: 78, kind: 'enemy', round: true, icon: '🕯️', name: '幽火亡魂', hp: 11,
    hpPct: 30, stats: [['物防', '4'], ['魔防', '20'], ['速度', '15'], ['晕抗', '1']] },
  { x: 86, y: 70, kind: 'enemy', icon: '🐗', name: '石皮野猪', hp: 19,
    hpPct: 47, stats: [['物防', '18'], ['魔防', '5'], ['速度', '5'], ['晕抗', '6']] },
  { x: 56, y: 22, kind: 'enemy', round: true, icon: '🦇', name: '血蝠', hp: 6,
    hpPct: 18, stats: [['物防', '3'], ['魔防', '4'], ['速度', '18'], ['晕抗', '0']] },
]);

// 顶部目标栏：当前选中单位的展示
const currentTarget = ref({
  name: '熔岩地精',
  hpPct: 64,
  stats: [['物防', '14'], ['魔防', '10'], ['速度', '9'], ['晕抗', '3']],
});
function selectToken(tk) {
  tokens.value.forEach((t) => { t.selected = t === tk; });
  currentTarget.value = {
    name: tk.name,
    hpPct: tk.hpPct,
    stats: (tk.stats || []).map(([k, v]) => ({ label: k, value: v })),
  };
}

const mapTools = ['选择', '测距', '提示'];
const activeTool = ref('选择');
function pickTool(t) { activeTool.value = t; }

const gridOn = ref(true);

// 回合操作浮窗
const round = ref(1);
const ap = ref([
  { label: '主行动', used: 0, max: 1 },
  { label: '次要行动', used: 0, max: 1 },
  { label: '移动', used: 0, max: 2 },
  { label: '自由动作', used: 1, max: 1 },
]);
const actingName = ref('白夜荧');
const endPulse = ref(false);
function endTurn() {
  endPulse.value = true;
  setTimeout(() => { endPulse.value = false; }, 260);
  round.value += 1;
  ap.value.forEach((a) => { a.used = 0; });
}

// 右侧标签页
const tabs = ['记录', '骰子', '角色'];
const activeTab = ref('记录');
function pickTab(t) { activeTab.value = t; }

const log = ref([
  { type: 'sys', time: '21:24:10', text: '[附加状态: 仇恨] → 饥饿巨犬锁定陆寒舟' },
  { type: 'say', name: '白夜荧', time: '21:24:15', text: '它扑过来了，先集火那只巨犬！', bubble: true },
  { type: 'say', name: '陆寒舟', time: '21:24:19', text: '交给我，其余人清小怪。', bubble: true },
  { type: 'dice', time: '21:24:31', formula: '1d20+7', result: '19', crit: true },
  { type: 'ability', time: '21:24:33', badge: '能力', name: '白夜荧 · 圣辉净化', dmg: '对 饥饿巨犬 造成 23 点神圣伤害', kind: 'hurt' },
  { type: 'dice', time: '21:24:40', formula: '2d6+4', result: '12' },
  { type: 'ability', time: '21:24:41', badge: '能力', name: '阿黛尔 · 守护祝福', dmg: '白夜荧 恢复 9 点生命', kind: 'heal' },
  { type: 'sys', time: '21:24:52', text: '饥饿巨犬 进入「狂暴」状态，下次攻击 +2' },
]);

// 底部空槽位占位控件
const deckBtns = ['部署', '状态', '锁定', '速查'];
const deckActive = ref('部署');
function pickDeck(b) { deckActive.value = b; }
const slotSel = ref('法术位 0/2');
const slotSelOptions = ['法术位 0/2', '特性位 1/2', '随身道具 3/6'];
const slotQs = ref('1');
const chipSel = ref('A 小队');
const chipOptions = ['A 小队', 'B 小队', 'C 小队'];

// 顶部操作按钮
const headerBtns = [
  { label: '复制邀请', primary: false, danger: false },
  { label: '席位选择', primary: false, danger: false },
  { label: '角色卡', primary: true, danger: false },
  { label: '离开', primary: false, danger: true },
];

// 角色面板（右侧「角色」标签）：角色总览的紧凑占位，仅展示不引用真实数据
const roleProfile = {
  name: '白夜荧',
  icon: '🧙',
  identity: '圣女 · 圣光使徒',
  level: 'Lv.6',
  race: '人类',
  hp: '34/38',
  hpPct: 89,
  will: '22',
  move: '9',
  ac: '16',
};
const roleAttributes = [
  { label: '力量', v: '2' }, { label: '敏捷', v: '3' }, { label: '耐力', v: '2' },
  { label: '智力', v: '4' }, { label: '感知', v: '3' }, { label: '决心', v: '4' },
  { label: '风度', v: '3' }, { label: '操控', v: '2' }, { label: '沉着', v: '3' },
];
const roleCore = [
  { label: '意志', value: '22' },
  { label: '移动', value: '9' },
  { label: '物防', value: '12' },
  { label: '魔防', value: '16' },
  { label: '速度', value: '11' },
  { label: '晕抗', value: '4' },
];
// 技能段（占位）：按 生理 / 心智 / 互动 分组，每项技能名 + 技能值
const roleSkillGroups = [
  { title: '生理系', skills: [['运动', '3'], ['肉搏', '2'], ['躲藏', '2'], ['求生', '1'], ['白刃', '2']] },
  { title: '心智系', skills: [['学识', '4'], ['调查', '3'], ['神秘学', '5'], ['科学', '2'], ['医学', '1']] },
  { title: '互动系', skills: [['感受', '4'], ['表达', '3'], ['交际', '2'], ['掩饰', '1'], ['胁迫', '2']] },
];
</script>

<template>
  <div class="realm-app">
    <!-- 【1】顶部导航栏 -->
    <header class="realm-header">
      <div class="realm-hd-left">
        <div class="realm-room"><span class="realm-room-placeholder">[房间名称]</span></div>
        <div class="realm-status"><span class="realm-status-dot"></span><span>[连接状态：已连接 5/5人]</span></div>
        <div class="realm-encounter">[遭遇战描述：地下迷宫 · 苏醒的兽群正从岩道深处涌来]</div>
      </div>

      <div class="realm-hd-mid">
        <span
          v-for="(p, i) in enemyPills"
          :key="p.name"
          class="realm-target-pill"
          :class="{ active: p.focused }"
          @click="focusEnemy(i)"
        >{{ p.name }} <span class="rm-hp-chip">{{ p.hp }}</span></span>
        <span class="realm-target-pill">＋</span>
      </div>

      <div class="realm-hd-right">
        <button
          v-for="b in headerBtns"
          :key="b.label"
          type="button"
          class="realm-pill"
          :class="{ primary: b.primary, danger: b.danger }"
        >{{ b.label }}</button>
      </div>
    </header>

    <!-- 【2/3/4】主区域：舞台列(左+中+底部槽位) + 右侧栏(整高) -->
    <div class="realm-main">
      <div class="realm-stage">
        <div class="realm-stage-mid">
          <!-- 左侧边栏 -->
          <aside class="realm-left">
            <section class="realm-party">
              <h2 class="realm-pane-title">队伍</h2>
              <div class="realm-party-list">
                <div
                  v-for="(m, i) in party"
                  :key="m.name"
                  class="realm-mcard"
                  :class="{ active: m.active }"
                  @click="selectParty(i)"
                >
                  <div class="realm-avatar">{{ m.icon }}</div>
                  <div class="realm-mcard-main">
                    <div class="realm-mcard-name"><span>{{ m.name }}</span></div>
                    <div class="realm-mcard-class">{{ m.cls }}</div>
                    <div class="realm-hpbar"><i :style="{ width: m.hpPct + '%' }"></i></div>
                    <div class="realm-mp-dots">
                      <i v-for="d in m.mpMax" :key="d" class="realm-mp-dot" :class="{ off: d > m.mp }"></i>
                    </div>
                  </div>
                  <span class="realm-mcard-tag" :class="m.flag === 'def' ? 'def' : 'atk'">{{ m.flag === 'def' ? '防' : '攻' }}</span>
                </div>
              </div>
            </section>

            <section class="realm-turn">
              <h2 class="realm-pane-title">回合顺序</h2>
              <div class="realm-turn-list">
                <div v-for="t in turnOrder" :key="t.idx + t.name" class="realm-turn-row" :class="{ current: t.current }">
                  <span class="realm-turn-idx">{{ t.idx }}</span>
                  <span class="realm-turn-name">{{ t.name }}</span>
                  <span class="realm-turn-flag" :class="t.flag === '敌' ? 'enemy' : 'friend'">{{ t.flag }}</span>
                </div>
              </div>
            </section>
          </aside>

          <!-- 中间主地图区 -->
          <main class="realm-center">
            <div class="realm-tgtbar">
              <span class="realm-tgt-name">{{ currentTarget.name }}</span>
              <div class="realm-tgt-hp"><div class="realm-tgt-hpbar"><i :style="{ width: currentTarget.hpPct + '%' }"></i></div></div>
              <div class="realm-tgt-stats">
                <div v-for="s in currentTarget.stats" :key="s.label" class="realm-tgt-stat">
                  <b>{{ s.value }}</b><span>{{ s.label }}</span>
                </div>
              </div>
            </div>

            <div class="realm-toolbar">
              <button
                v-for="t in mapTools"
                :key="t"
                type="button"
                class="realm-tool"
                :class="{ active: activeTool === t }"
                @click="pickTool(t)"
              >{{ t }}</button>
              <div class="realm-zoom">
                <span class="realm-zoom-val">100%</span><span>缩放</span>
              </div>
              <label class="realm-grid-toggle">
                <input type="checkbox" v-model="gridOn" />
                <span>网格</span>
              </label>
            </div>

            <!-- 回合操作浮窗 -->
            <div class="realm-turnoverlay" :class="{ pulse: endPulse }">
              <span class="realm-round">ROUND {{ round }}</span>
              <span class="realm-turn-name">{{ actingName }}</span>
              <div class="realm-ap">
                <div v-for="a in ap" :key="a.label" class="realm-ap-item">
                  <b>{{ a.used }}/{{ a.max }}</b><span>{{ a.label }}</span>
                </div>
              </div>
              <button type="button" class="realm-endturn" @click="endTurn">结束回合</button>
            </div>

            <!-- 地图 -->
            <div class="realm-map">
              <div class="realm-map-bg"></div>
              <div class="realm-map-grid" v-show="gridOn"></div>
              <div class="realm-map-vignette"></div>

              <div
                v-for="tk in tokens"
                :key="tk.name"
                class="realm-token"
                :class="[tk.kind === 'player' ? 'player' : 'enemy', tk.round ? 'round' : '', tk.selected ? 'selected' : '']"
                :style="{ left: tk.x + '%', top: tk.y + '%' }"
                @click="selectToken(tk)"
              >
                <div class="realm-token-core">
                  <span v-if="tk.hp != null" class="realm-token-hpchip">{{ tk.hp }}</span>
                  <span>{{ tk.icon }}</span>
                  <span v-if="tk.st" class="realm-token-icon" :class="tk.st === '防' ? 'def' : 'atk'"></span>
                </div>
                <span class="realm-token-name">{{ tk.name }}</span>
              </div>
            </div>
          </main>
        </div>

        <!-- 中层框体：从左沿延伸到聊天框(右栏)前停下，放方/圆占位按钮 -->
        <div class="realm-hband">
          <span class="realm-hband-label">框体</span>
          <div class="realm-hband-shapes">
            <button type="button" class="realm-dock-icon square">⌁</button>
            <button type="button" class="realm-dock-icon round">◉</button>
            <button type="button" class="realm-dock-icon square">⛶</button>
            <button type="button" class="realm-dock-icon round">✦</button>
            <button type="button" class="realm-dock-icon square">⚔</button>
            <button type="button" class="realm-dock-icon round">◆</button>
            <button type="button" class="realm-dock-icon square">🞓</button>
            <button type="button" class="realm-dock-icon round big">◎</button>
          </div>
          <span class="realm-hband-note">（中层框体占位：方/圆按钮，留待填充功能）</span>
        </div>

        <!-- 最底部控件框体：横跨 左+中，到右栏左侧停下 -->
        <footer class="realm-dock">
          <span class="realm-dock-label">空槽位</span>
          <div class="realm-dock-group">
            <button
              v-for="b in deckBtns"
              :key="b"
              type="button"
              class="realm-dock-btn"
              :class="{ active: deckActive === b }"
              @click="pickDeck(b)"
            >{{ b }}</button>
          </div>

          <label class="realm-dock-field"><span>资源</span>
            <select v-model="slotSel">
              <option v-for="o in slotSelOptions" :key="o" :value="o">{{ o }}</option>
            </select>
          </label>

          <label class="realm-dock-field"><span>数量</span>
            <input type="number" v-model="slotQs" min="0" />
          </label>

          <label class="realm-dock-field"><span>小队</span>
            <select v-model="chipSel">
              <option v-for="o in chipOptions" :key="o" :value="o">{{ o }}</option>
            </select>
          </label>

          <span class="realm-dock-note">（底部空槽位占位控件，留待后续填充功能）</span>
          <button type="button" class="realm-dock-go" @click="go('realm')">返回房间列表</button>
        </footer>
      </div>

      <!-- 右侧边栏（整高，底部槽位不停留在其下） -->
      <aside class="realm-right">
        <div class="realm-tabs">
          <span
            v-for="t in tabs"
            :key="t"
            class="realm-tab"
            :class="{ active: activeTab === t }"
            @click="pickTab(t)"
          >{{ t }}</span>
        </div>

        <div class="realm-log" v-show="activeTab === '记录'">
          <div v-for="(e, i) in log" :key="i" class="realm-entry">
            <template v-if="e.type === 'sys'">
              <span class="realm-entry-meta">{{ e.time }}</span>
              <span class="realm-sys">{{ e.text }}</span>
            </template>
            <template v-else-if="e.type === 'say'">
              <span class="realm-entry-meta"><b>{{ e.name }}</b><span>{{ e.time }}</span></span>
              <span class="realm-bubble">{{ e.text }}</span>
            </template>
            <template v-else-if="e.type === 'dice'">
              <span class="realm-entry-meta">{{ e.time }}</span>
              <div class="realm-dice">
                <span class="realm-dice-icon">D20</span>
                <span class="realm-dice-formula">{{ e.formula }}</span>
                <span class="realm-dice-result" :class="{ crit: e.crit }">{{ e.result }}</span>
              </div>
            </template>
            <template v-else-if="e.type === 'ability'">
              <span class="realm-entry-meta"><b>{{ e.name }}</b><span>{{ e.time }}</span></span>
              <div class="realm-ability">
                <span class="realm-ability-head"><span class="realm-ability-badge">{{ e.badge }}</span></span>
                <span class="realm-ability-dmg" :class="e.kind === 'heal' ? 'heal' : 'hurt'">{{ e.dmg }}</span>
              </div>
            </template>
          </div>
        </div>

        <div class="realm-log" v-show="activeTab === '骰子'">
          <span class="realm-tab-empty">[骰子面板占位：常用骰组 / 历史掷骰]</span>
        </div>

        <div class="realm-log realm-role" v-show="activeTab === '角色'">
          <!-- 角色头卡 -->
          <div class="realm-role-head">
            <div class="realm-role-avatar">{{ roleProfile.icon }}</div>
            <div class="realm-role-headinfo">
              <div class="realm-role-name">{{ roleProfile.name }}</div>
              <div class="realm-role-sub">{{ roleProfile.identity }} · {{ roleProfile.level }}</div>
              <div class="realm-role-sub">{{ roleProfile.race }}</div>
            </div>
          </div>

          <!-- 生命信息 -->
          <div class="realm-role-block">
            <div class="realm-role-blocktitle">生命信息</div>
            <div class="realm-role-hprow">
              <span class="realm-role-hplabel">生命</span>
              <div class="realm-role-hpbar"><i :style="{ width: roleProfile.hpPct + '%' }"></i></div>
              <span class="realm-role-hpnum">{{ roleProfile.hp }}</span>
            </div>
          </div>

          <!-- 属性段：九项属性 -->
          <div class="realm-role-block">
            <div class="realm-role-blocktitle">属性</div>
            <div class="realm-role-attrs">
              <div v-for="a in roleAttributes" :key="a.label" class="realm-role-attr">
                <span class="realm-role-attr-k">{{ a.label }}</span>
                <span class="realm-role-attr-v">{{ a.v }}</span>
              </div>
            </div>
          </div>

          <!-- 技能段：三系分组简表 -->
          <div class="realm-role-block">
            <div class="realm-role-blocktitle">技能</div>
            <div v-for="g in roleSkillGroups" :key="g.title" class="realm-role-skillgroup">
              <span class="realm-role-skillgroup-k">{{ g.title }}</span>
              <div class="realm-role-skills">
                <div v-for="[n, v] in g.skills" :key="n" class="realm-role-skill">
                  <span class="realm-role-skill-name">{{ n }}</span>
                  <span class="realm-role-skill-value">{{ v }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 核心数值（防御/派生） -->
          <div class="realm-role-block">
            <div class="realm-role-blocktitle">防御与派生</div>
            <div class="realm-role-core">
              <div v-for="c in roleCore" :key="c.label" class="realm-role-coreitem">
                <span class="realm-role-core-v">{{ c.value }}</span>
                <span class="realm-role-core-k">{{ c.label }}</span>
              </div>
            </div>
          </div>

          <span class="realm-tab-empty">（角色总览占位，仅供展示）</span>
        </div>

        <div class="realm-inputbar">
          <input class="realm-input" type="text" placeholder="说点什么，或 /r 2d6+3 掷骰" />
          <button type="button" class="realm-send">发送</button>
        </div>
      </aside>
    </div>
  </div>
</template>