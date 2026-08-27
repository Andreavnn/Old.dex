import { createRouter, createWebHistory } from 'vue-router'
import HomeView from './views/HomeView.vue'
import RulesView from './views/RulesView.vue'
import GamesView from './views/GamesView.vue'
import GameCreateView from './views/GameCreateView.vue'
import GameMatchView from './views/GameMatchView.vue'
import MatchUnitProfileView from './views/MatchUnitProfileView.vue'
import ArmyView from './views/ArmyView.vue'
import UnitView from './views/UnitView.vue'
import SettingsView from './views/SettingsView.vue'
import CreateListView from './views/CreateListView.vue'
import ListBuilderView from './views/ListBuilderView.vue'
import ListView from './views/ListView.vue'
import RuleReaderView from './views/RuleReaderView.vue'
import RuleIndexGroupView from './views/RuleIndexGroupView.vue'
import ChangelogView from './views/ChangelogView.vue'
import WelcomeView from './views/WelcomeView.vue'
import { hasSeenWelcome } from './services/welcome'

const router = createRouter({
  history: createWebHistory(),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    { path: '/', redirect: '/lists' },
    { path: '/welcome', name: 'welcome', component: WelcomeView },
    { path: '/lists', name: 'lists', component: HomeView },
    { path: '/lists/create', name: 'create-list', component: CreateListView },
    { path: '/lists/builder', name: 'list-builder', component: ListBuilderView },
    { path: '/lists/shared', name: 'list-shared', component: ListView },
    { path: '/lists/view/:listId', name: 'list-view', component: ListView },
    { path: '/rules', name: 'rules', component: RulesView },
    { path: '/rules/read/:pathMatch(.*)*', name: 'rule-reader', component: RuleReaderView },
    { path: '/rules/index/:kind/:pathMatch(.*)*', name: 'rule-index-group', component: RuleIndexGroupView },
    { path: '/games', name: 'games', component: GamesView },
    { path: '/games/new', name: 'game-create', component: GameCreateView },
    { path: '/games/:gameId/unit/:instanceId', name: 'game-unit-profile', component: MatchUnitProfileView },
    { path: '/games/:gameId', name: 'game-match', component: GameMatchView },
    { path: '/army/:armySlug', name: 'army', component: ArmyView },
    { path: '/army/:armySlug/unit/:unitSlug', name: 'unit', component: UnitView },
    { path: '/settings', name: 'settings', component: SettingsView },
    { path: '/changelog', name: 'changelog', component: ChangelogView },
  ],
})

router.beforeEach((to) => {
  if (to.name === 'welcome' || hasSeenWelcome()) return true
  return { name: 'welcome', query: { continue: to.fullPath } }
})

export default router
