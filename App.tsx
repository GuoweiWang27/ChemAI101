import React, { useState } from 'react';
import { ReactionLab } from './components/ReactionLab';
import { BuilderModule } from './components/BuilderModule';
import { Atom, FlaskConical, Languages } from 'lucide-react';
import { useLanguage } from './contexts/LanguageContext';

function App() {
  const [activeTab, setActiveTab] = useState<'reaction' | 'builder'>('reaction');
  const { language, setLanguage, t } = useLanguage();

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'zh' : 'en');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-science-600 p-2 rounded-lg">
              <Atom className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-science-700 to-science-500">
              {t('appTitle')}
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <nav className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
               <button
                 onClick={() => setActiveTab('reaction')}
                 className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2
                   ${activeTab === 'reaction' 
                     ? 'bg-white text-science-700 shadow-sm' 
                     : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
               >
                 <FlaskConical className="w-4 h-4" />
                 <span className="hidden sm:inline">{t('navReaction')}</span>
               </button>
               <button
                 onClick={() => setActiveTab('builder')}
                 className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2
                   ${activeTab === 'builder' 
                     ? 'bg-white text-science-700 shadow-sm' 
                     : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
               >
                 <Atom className="w-4 h-4" />
                 <span className="hidden sm:inline">{t('navBuilder')}</span>
               </button>
            </nav>

            <button
              onClick={toggleLanguage}
              className="group flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white shadow-lg hover:bg-science-600 hover:shadow-science-500/25 transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0"
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
        <div className="h-[calc(100vh-64px)] overflow-hidden">
           {activeTab === 'reaction' ? <ReactionLab /> : <BuilderModule />}
        </div>
      </main>
    </div>
  );
}

export default App;