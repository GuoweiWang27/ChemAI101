import React, { lazy, Suspense, useEffect, useState } from 'react';
import { HomeModule } from './components/HomeModule';
import { Atom, BookOpen, Database, FlaskConical, Gamepad2, Home as HomeIcon, Languages } from 'lucide-react';
import { useLanguage } from './contexts/LanguageContext';
import { parseRoute, updateRouteParams, RouteTarget } from './utils/routeParams';
import { getReaction } from './src/data/reactions';

const ReactionLab = lazy(() => import('./components/ReactionLab').then((module) => ({ default: module.ReactionLab })));
const BuilderModule = lazy(() => import('./components/BuilderModule').then((module) => ({ default: module.BuilderModule })));
const LibraryModule = lazy(() => import('./components/LibraryModule').then((module) => ({ default: module.LibraryModule })));
const TextbookModule = lazy(() => import('./components/TextbookModule').then((module) => ({ default: module.TextbookModule })));
const ReactionPage = lazy(() => import('./components/ReactionPage').then((module) => ({ default: module.ReactionPage })));

function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'textbook' | 'reaction' | 'builder' | 'library'>('home');
  const [route, setRoute] = useState<RouteTarget>(() => parseRoute(window.location.search));
  const { language, setLanguage, t } = useLanguage();

  useEffect(() => {
    const sync = () => setRoute(parseRoute(window.location.search));
    window.addEventListener('popstate', sync);
    window.addEventListener('chemai-route', sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('chemai-route', sync);
    };
  }, []);

  const reaction = route.slug ? getReaction(route.slug) : undefined;
  const exitReaction = () => updateRouteParams({ r: null, mode: null });
  /** 子页面（反应条目）激活时点击任何标签 = 退出子页并切换 */
  const switchTab = (tab: typeof activeTab) => {
    if (route.slug) exitReaction();
    setActiveTab(tab);
  };

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'zh' : 'en');
  };

  const navItems = [
    { tab: 'home', label: t('navHome'), mobileLabel: language === 'zh' ? '首页' : 'Home', Icon: HomeIcon },
    { tab: 'textbook', label: t('navLibraryCurated'), mobileLabel: language === 'zh' ? '教材库' : 'Textbook', Icon: BookOpen },
    { tab: 'reaction', label: t('navReaction'), mobileLabel: language === 'zh' ? '实验室' : 'Lab', Icon: FlaskConical },
    { tab: 'builder', label: t('navBuilder'), mobileLabel: language === 'zh' ? '构建器' : 'Builder', Icon: Atom },
    { tab: 'library', label: t('navLibrary'), mobileLabel: language === 'zh' ? '分子库' : 'Library', Icon: Database },
  ] as const;

  return (
    <div className="min-h-screen bg-[#faf8f5] flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white border-b border-[#e8d5b8] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="ChemAI101" className="h-10 w-10 -my-1 rounded-xl shadow-[0_2px_6px_rgba(0,0,0,0.22)]" />
            <h1 className="hidden sm:block font-display text-2xl font-bold">
              <span className="text-science-700">ChemAI</span>
              <span className="text-science-400">101</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-4 min-w-0">
            <nav className="hidden lg:flex items-center gap-1 bg-[#f0ece4] p-1 rounded-xl" aria-label={language === 'zh' ? '主导航' : 'Primary navigation'}>
              {navItems.map(({ tab, label, Icon }) => (
                <button
                  key={tab}
                  onClick={() => switchTab(tab)}
                  aria-current={activeTab === tab ? 'page' : undefined}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap
                    ${activeTab === tab
                      ? 'bg-white text-science-700 shadow-sm'
                      : 'text-[#6f685d] hover:text-[#1a1a1a] hover:bg-white'}`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{label}</span>
                </button>
              ))}
              <a
                href="/reaction-tray/"
                className="flex items-center gap-2 whitespace-nowrap rounded-lg bg-[#8c1515] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#6f1010] hover:shadow-md"
              >
                <Gamepad2 className="h-4 w-4" />
                <span>{t('reactionTrayNav')}</span>
              </a>
            </nav>

            <button
              onClick={toggleLanguage}
              className="group shrink-0 flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl bg-[#1a1a1a] text-white shadow-lg hover:bg-science-600 hover:shadow-science-500/25 transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0"
              title={language === 'en' ? "Switch to Chinese" : "切换为英文"}
            >
              <Languages className="w-4 h-4 group-hover:rotate-12 transition-transform" />
              <span className="text-sm font-bold tracking-wide min-w-[3rem] text-center">
                {language === 'en' ? '中文' : 'English'}
              </span>
            </button>
          </div>
        </div>

        <nav
          className="grid h-14 grid-cols-6 gap-1 border-t border-[#f0ece4] bg-white px-2 py-1 lg:hidden"
          aria-label={language === 'zh' ? '主导航' : 'Primary navigation'}
        >
          {navItems.map(({ tab, label, mobileLabel, Icon }) => (
            <button
              key={tab}
              onClick={() => switchTab(tab)}
              aria-current={activeTab === tab ? 'page' : undefined}
              aria-label={label}
              className={`flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[10px] font-semibold leading-tight transition-colors
                ${activeTab === tab
                  ? 'bg-[#f0ece4] text-science-700'
                  : 'text-[#6f685d] active:bg-[#f0ece4]'}`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="w-full truncate text-center">{mobileLabel}</span>
            </button>
          ))}
          <a
            href="/reaction-tray/"
            aria-label={language === 'zh' ? '打开反应槽游戏' : 'Open Reaction Tray game'}
            className="flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg bg-[#f7ecec] px-1 text-[10px] font-semibold leading-tight text-[#8c1515] transition-colors active:bg-[#eed9d9]"
          >
            <Gamepad2 className="h-4 w-4 shrink-0" />
            <span className="w-full truncate text-center">{t('reactionTrayNav')}</span>
          </a>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto">
        <div className="h-[calc(100dvh-120px)] overflow-y-auto lg:h-[calc(100dvh-64px)] lg:overflow-hidden">
          <Suspense
            fallback={(
              <div role="status" className="grid h-full place-items-center px-6 text-sm font-semibold text-[#6f685d]">
                {language === 'zh' ? '正在准备实验模块…' : 'Preparing the lab module…'}
              </div>
            )}
          >
            {reaction ? (
              <ReactionPage key={reaction.id} reaction={reaction} present={route.present} onExit={exitReaction} />
            ) : activeTab === 'home' ? (
              <HomeModule onOpen={switchTab} />
            ) : activeTab === 'reaction' ? (
              <ReactionLab />
            ) : activeTab === 'textbook' ? (
              <TextbookModule />
            ) : activeTab === 'library' ? (
              <LibraryModule />
            ) : (
              <BuilderModule />
            )}
          </Suspense>
        </div>
      </main>
    </div>
  );
}

export default App;
