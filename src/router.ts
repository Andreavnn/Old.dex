import { createRouter, createWebHistory } from 'vue-router'
import HomeView from './views/HomeView.vue'
import RulesView from './views/RulesView.vue'
import GamesView from './views/GamesView.vue'
import GameCreateView from './views/GameCreateView.vue'
import GameMatchView from './views/GameMatchView.vue'
import ArmyView from './views/ArmyView.vue'
import UnitView from './views/UnitView.vue'
import SettingsView from './views/SettingsView.vue'
import CreateListView from './views/CreateListView.vue'
import ListBuilderView from './views/ListBuilderView.vue'
import RuleReaderView from './views/RuleReaderView.vue'
import RuleIndexGroupView from './views/RuleIndexGroupView.vue'
import ChangelogView from './views/ChangelogView.vue'

const router = createRouter({
  history: createWebHistory(),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    { path: '/', redirect: '/lists' },
    { path: '/lists', name: 'lists', component: HomeView },
    { path: '/lists/create', name: 'create-list', component: CreateListView },
    { path: '/lists/builder', name: 'list-builder', component: ListBuilderView },
    { path: '/rules', name: 'rules', component: RulesView },
    { path: '/rules/read/:pathMatch(.*)*', name: 'rule-reader', component: RuleReaderView },
    { path: '/rules/index/:kind/:pathMatch(.*)*', name: 'rule-index-group', component: RuleIndexGroupView },
    { path: '/games', name: 'games', component: GamesView },
    { path: '/games/new', name: 'game-create', component: GameCreateView },
    { path: '/games/:gameId', name: 'game-match', component: GameMatchView },
    { path: '/army/:armySlug', name: 'army', component: ArmyView },
    { path: '/army/:armySlug/unit/:unitSlug', name: 'unit', component: UnitView },
    { path: '/settings', name: 'settings', component: SettingsView },
    { path: '/changelog', name: 'changelog', component: ChangelogView },
  ],
})

export default router
