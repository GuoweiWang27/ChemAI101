import React, { useEffect, useState } from 'react';
import { ReactionLab } from './components/ReactionLab';
import { BuilderModule } from './components/BuilderModule';
import { LibraryModule } from './components/LibraryModule';
import { TextbookModule } from './components/TextbookModule';
import { ReactionPage } from './components/ReactionPage';
import { Atom, BookOpen, Database, FlaskConical, Languages } from 'lucide-react';
import { useLanguage } from './contexts/LanguageContext';
import { parseRoute, updateRouteParams, RouteTarget } from './utils/routeParams';
import { getReaction } from './src/data/reactions';

function App() {
  const [activeTab, setActiveTab] = useState<'textbook' | 'reaction' | 'builder' | 'library'>('textbook');
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

  return (
    <div className="min-h-screen bg-[#faf8f5] flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white border-b border-[#e8d5b8] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-science-600 p-2 rounded-lg">
              <Atom className="w-6 h-6 text-white" />
            </div>
            <h1 className="hidden sm:block font-display text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-science-700 to-science-500">
              {t('appTitle')}
            </h1>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <nav className="flex items-center gap-1 bg-[#f0ece4] p-1 rounded-xl overflow-x-auto max-w-full">
               <button
                 onClick={() => switchTab('textbook')}
                 className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2
                   ${activeTab === 'textbook'
                     ? 'bg-white text-science-700 shadow-sm'
                     : 'text-[#6f685d] hover:text-[#1a1a1a] hover:bg-white'}`}
               >
                 <BookOpen className="w-4 h-4" />
                 <span className="hidden sm:inline">{t('navLibraryCurated')}</span>
               </button>
               <button
                 onClick={() => switchTab('reaction')}
                 className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2
                   ${activeTab === 'reaction' 
                     ? 'bg-white text-science-700 shadow-sm' 
                     : 'text-[#6f685d] hover:text-[#1a1a1a] hover:bg-white'}`}
               >
                 <FlaskConical className="w-4 h-4" />
                 <span className="hidden sm:inline">{t('navReaction')}</span>
               </button>
               <button
                 onClick={() => switchTab('builder')}
                 className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2
                   ${activeTab === 'builder' 
                     ? 'bg-white text-science-700 shadow-sm' 
                     : 'text-[#6f685d] hover:text-[#1a1a1a] hover:bg-white'}`}
               >
                 <Atom className="w-4 h-4" />
                 <span className="hidden sm:inline">{t('navBuilder')}</span>
               </button>
               <button
                 onClick={() => switchTab('library')}
                 className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2
                   ${activeTab === 'library'
                     ? 'bg-white text-science-700 shadow-sm'
                     : 'text-[#6f685d] hover:text-[#1a1a1a] hover:bg-white'}`}
               >
                 <Database className="w-4 h-4" />
                 <span className="hidden sm:inline">{t('navLibrary')}</span>
               </button>
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
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto">
        <div className="h-[calc(100dvh-64px)] overflow-y-auto lg:overflow-hidden">
           {reaction ? (
             <ReactionPage reaction={reaction} present={route.present} onExit={exitReaction} />
           ) : activeTab === 'reaction' ? (
             <ReactionLab />
           ) : activeTab === 'textbook' ? (
             <TextbookModule />
           ) : activeTab === 'library' ? (
             <LibraryModule />
           ) : (
             <BuilderModule />
           )}
        </div>
      </main>
    </div>
  );
}

export default App;