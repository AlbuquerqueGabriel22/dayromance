import React, { useState, useEffect, useMemo } from 'react';
import { 
  Heart, Calendar, Clock, MapPin, Gift, CheckCircle, Circle, 
  User, Users, DollarSign, Edit, Trash2, Plus, Lock, Send, 
  Sparkles, Camera, Phone, Mail, ChevronRight, AlertCircle, 
  Layout, Palette, CheckSquare, Settings, LogOut, ExternalLink,
  ChevronDown, MessageSquare, PieChart, ShieldAlert, Award, Copy,
  Check, RefreshCw, X
} from 'lucide-react';

// --- ESTILOS VISUAIS E PALETA DE CORES DA FOTO DE REFERÊNCIA ---
// Bege Claro (#FCF9F2), Areia (#F4EFE6), Dourado/Bege Médio (#E8DED1)
// Verde Oliva Primário (#4A5D4E), Verde Oliva Escuro (#364539)

const isNonPayingChild = (member, buffetPayingAge) =>
  member.isChild && member.age < buffetPayingAge;

const THEMES = {
  jardim: {
    id: 'jardim',
    name: 'Jardim Clássico',
    bgPrimary: 'bg-[#FCF9F2]',
    bgSecondary: 'bg-[#F4EFE6]',
    bgCard: 'bg-white',
    accent: 'bg-[#4A5D4E]',
    accentHover: 'hover:bg-[#364539]',
    accentText: 'text-[#4A5D4E]',
    border: 'border-[#E8DED1]',
    fontHeader: 'font-serif',
  },
  boho: {
    id: 'boho',
    name: 'Boho Rustique',
    bgPrimary: 'bg-[#FAF6F0]',
    bgSecondary: 'bg-[#F2EADF]',
    bgCard: 'bg-[#FFFDF9]',
    accent: 'bg-[#8C6D58]',
    accentHover: 'hover:bg-[#6E5443]',
    accentText: 'text-[#8C6D58]',
    border: 'border-[#E0D3C3]',
    fontHeader: 'font-serif',
  },
  minimalista: {
    id: 'minimalista',
    name: 'Minimalista Chic',
    bgPrimary: 'bg-[#F9F9F9]',
    bgSecondary: 'bg-[#F0F0F0]',
    bgCard: 'bg-white',
    accent: 'bg-[#2B2B2B]',
    accentHover: 'hover:bg-[#111111]',
    accentText: 'text-[#2B2B2B]',
    border: 'border-[#E5E5E5]',
    fontHeader: 'font-sans',
  }
};

// --- EFEITO DE CONFETES SIMPLIFICADO ---
const ConfettiEffect = () => {
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {[...Array(40)].map((_, i) => (
        <div
          key={i}
          className="absolute animate-bounce"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDuration: `${1.5 + Math.random() * 3}s`,
            animationDelay: `${Math.random() * 2}s`,
            width: '10px',
            height: '10px',
            backgroundColor: ['#4A5D4E', '#D4AF37', '#E8DED1', '#B5C0D0'][i % 4],
            borderRadius: i % 2 === 0 ? '50%' : '2px',
            transform: `rotate(${Math.random() * 360}deg)`,
            opacity: 0.8
          }}
        />
      ))}
    </div>
  );
};

export default function App() {
  // Estado para alternar entre "Guest" (Visão Convidado) e "Admin" (Painel Noivos)
  const [viewMode, setViewMode] = useState('guest'); 

  // --- ESTADO GERAL DE CONFIGURAÇÃO DO CASAL ---
  const [coupleData, setCoupleData] = useState({
    groom: 'Rafael',
    bride: 'Amanda',
    monogram: 'A ♡ R',
    weddingDate: '2026-10-24T16:00',
    locationName: 'Espaço Jardim das Flores',
    address: 'Rua das Acácias, 123 - Gramado / RS',
    ceremonialist: 'Mariana Cerimonial',
    email: 'contato@amandaerafael.com',
    story: 'Nos conhecemos na faculdade e desde o primeiro instante soubemos que caminharíamos juntos. O amor cresceu a cada conversa, viagem e sonho compartilhado. Agora, estamos prontos para dar o passo mais importante das nossas vidas!',
    coverImage: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=1200',
    buffetPayingAge: 7, // Crianças a partir de 7 anos pagam
    rsvpDeadline: '2026-09-24',
    selectedTheme: 'jardim'
  });

  const activeTheme = THEMES[coupleData.selectedTheme] || THEMES.jardim;

  // --- ESTADO DE CONVIDADOS / FAMÍLIAS ---
  const [families, setFamilies] = useState([
    {
      id: 'f1',
      name: 'Família Silva',
      phone: '(54) 99999-1111',
      members: [
        { id: 'm1', name: 'Ana Clara Silva', isChild: false, age: 32, confirmed: true },
        { id: 'm2', name: 'Carlos Eduardo Silva', isChild: false, age: 35, confirmed: true },
        { id: 'm3', name: 'Mariana Silva', isChild: false, age: 18, confirmed: false },
        { id: 'm4', name: 'João Pedro Silva', isChild: true, age: 5, confirmed: false },
      ]
    },
    {
      id: 'f2',
      name: 'Família Oliveira',
      phone: '(54) 98888-2222',
      members: [
        { id: 'm5', name: 'Roberto Oliveira', isChild: false, age: 45, confirmed: true },
        { id: 'm6', name: 'Beatriz Oliveira', isChild: false, age: 42, confirmed: true },
        { id: 'm7', name: 'Lucas Oliveira', isChild: true, age: 10, confirmed: true },
        { id: 'm8', name: 'Sofia Oliveira', isChild: true, age: 4, confirmed: true },
      ]
    },
    {
      id: 'f3',
      name: 'Amigos do Casal',
      phone: '(54) 97777-3333',
      members: [
        { id: 'm9', name: 'Fernanda Lima', isChild: false, age: 28, confirmed: null },
        { id: 'm10', name: 'Thiago Costa', isChild: false, age: 30, confirmed: null },
      ]
    }
  ]);

  // --- ESTADO DE PRESENTES E PIX ---
  const [gifts, setGifts] = useState([
    {
      id: 'g1',
      title: 'Jogo de Panelas Antiaderente',
      price: 250.00,
      image: 'https://images.unsplash.com/photo-1584992236310-6edddc08acff?auto=format&fit=crop&q=80&w=400',
      totalQuotas: 1,
      takenQuotas: 0,
      givenBy: null
    },
    {
      id: 'g2',
      title: 'Kit Cama e Banho Premium 600 Fios',
      price: 180.00,
      image: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&q=80&w=400',
      totalQuotas: 5,
      takenQuotas: 2,
      givenBy: 'Carlos Eduardo Silva (2 cotas)'
    },
    {
      id: 'g3',
      title: 'Viagem dos Sonhos - Cota Lua de Mel',
      price: 500.00,
      image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=400',
      totalQuotas: 10,
      takenQuotas: 4,
      givenBy: 'Roberto Oliveira, Ana Clara Silva'
    },
    {
      id: 'g4',
      title: 'Cafeteira de Aço Inox Espresso',
      price: 320.00,
      image: 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?auto=format&fit=crop&q=80&w=400',
      totalQuotas: 1,
      takenQuotas: 1,
      givenBy: 'Fernanda Lima'
    }
  ]);

  // --- ESTADO DE MENSAGENS MURAL DE RECADOS ---
  const [guestMessages, setGuestMessages] = useState([
    { id: 'msg1', name: 'Carlos Eduardo', text: 'Estamos muito ansiosos para celebrar essa união mágica com vocês! Que Deus abençoe!', date: '22/10/2026' },
    { id: 'msg2', name: 'Tia Beatriz', text: 'Desejo toda a felicidade do mundo ao casal lindo!', date: '20/10/2026' }
  ]);

  // --- ESTADO DE CHECKLIST DE TAREFAS ---
  const [tasks, setTasks] = useState([
    { id: 't1', title: 'Definir data e local da cerimônia', category: '12 meses antes', completed: true },
    { id: 't2', title: 'Contratar cerimonialista e fotógrafo', category: '10 meses antes', completed: true },
    { id: 't3', title: 'Pesquisar e fechar serviço de buffet', category: '8 meses antes', completed: true },
    { id: 't4', title: 'Escolher decoração e arranjos florais', category: '6 meses antes', completed: false },
    { id: 't5', title: 'Enviar Save the Date aos convidados', category: '4 meses antes', completed: false },
    { id: 't6', title: 'Degustação final do menu e doces', category: '2 meses antes', completed: false },
    { id: 't7', title: 'Reunião final com fornecedores', category: '1 mês antes', completed: false },
  ]);

  // --- ESTADO DE CONTROLE FINANCEIRO / FORNECEDORES ---
  const [financials, setFinancials] = useState({
    targetBudget: 80000.00,
    suppliers: [
      {
        id: 's1',
        name: 'Espaço e Buffet Flores',
        category: 'Local e Gastronomia',
        agreedValue: 32000.00,
        installments: [
          { number: 1, value: 8000, dueDate: '2026-01-10', paid: true },
          { number: 2, value: 8000, dueDate: '2026-04-10', paid: true },
          { number: 3, value: 8000, dueDate: '2026-07-10', paid: false },
          { number: 4, value: 8000, dueDate: '2026-10-01', paid: false },
        ]
      },
      {
        id: 's2',
        name: 'Decoração e Floricultura Art',
        category: 'Decoração',
        agreedValue: 12000.00,
        installments: [
          { number: 1, value: 6000, dueDate: '2026-03-15', paid: true },
          { number: 2, value: 6000, dueDate: '2026-09-15', paid: false },
        ]
      },
      {
        id: 's3',
        name: 'Lumière Fotografia e Filmes',
        category: 'Foto e Vídeo',
        agreedValue: 6000.00,
        installments: [
          { number: 1, value: 2000, dueDate: '2026-02-01', paid: true },
          { number: 2, value: 2000, dueDate: '2026-06-01', paid: true },
          { number: 3, value: 2000, dueDate: '2026-09-20', paid: false },
        ]
      }
    ]
  });

  // Confetes do dia especial
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    // Verifica se hoje é o dia do casamento para acionar o efeito festivo
    const today = new Date().toISOString().slice(0, 10);
    const eventDay = coupleData.weddingDate.slice(0, 10);
    if (today === eventDay) {
      setShowConfetti(true);
    }
  }, [coupleData.weddingDate]);

  return (
    <div className={`min-h-screen ${activeTheme.bgPrimary} text-slate-800 transition-colors duration-300 font-sans`}>
      {showConfetti && <ConfettiEffect />}

      {/* --- BARRA SUPERIOR DE NAVEGAÇÃO / TROCA DE MODO --- */}
      <header className="sticky top-0 z-40 bg-slate-900 text-white shadow-md px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className="font-bold text-amber-300 tracking-wider text-sm md:text-base flex items-center gap-1.5">
            <Sparkles size={18} /> CASAMENTO APP
          </span>
          <span className="hidden md:inline text-slate-400 text-xs">|</span>
          <span className="hidden md:inline text-xs text-slate-300">
            Design Inspirado no Layout de Referência
          </span>
        </div>

        <div className="flex items-center space-x-2 bg-slate-800 p-1 rounded-lg border border-slate-700">
          <button
            onClick={() => setViewMode('guest')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
              viewMode === 'guest'
                ? 'bg-[#4A5D4E] text-white shadow'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <User size={14} /> Site dos Convidados
          </button>
          <button
            onClick={() => setViewMode('admin')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${
              viewMode === 'admin'
                ? 'bg-[#4A5D4E] text-white shadow'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Lock size={14} /> Painel dos Noivos
          </button>
        </div>
      </header>

      {/* --- RENDERIZAÇÃO CONDICIONAL DA VISÃO --- */}
      {viewMode === 'guest' ? (
        <GuestSiteView 
          coupleData={coupleData} 
          activeTheme={activeTheme}
          families={families}
          setFamilies={setFamilies}
          gifts={gifts}
          setGifts={setGifts}
          guestMessages={guestMessages}
          setGuestMessages={setGuestMessages}
        />
      ) : (
        <AdminDashboardView 
          coupleData={coupleData}
          setCoupleData={setCoupleData}
          activeTheme={activeTheme}
          families={families}
          setFamilies={setFamilies}
          gifts={gifts}
          setGifts={setGifts}
          tasks={tasks}
          setTasks={setTasks}
          financials={financials}
          setFinancials={setFinancials}
          setShowConfetti={setShowConfetti}
        />
      )}
    </div>
  );
}

/* =========================================================================
   1. VISÃO DO SITE DOS CONVIDADOS (GUEST SITE VIEW)
   ========================================================================= */
function GuestSiteView({ 
  coupleData, 
  activeTheme, 
  families, 
  setFamilies, 
  gifts, 
  setGifts,
  guestMessages,
  setGuestMessages
}) {
  const [activeTab, setActiveTab] = useState('inicio');

  // Rola suavemente até as seções
  const scrollToSection = (id) => {
    setActiveTab(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="pb-20">
      {/* NAVEGAÇÃO INTERNA DO SITE DOS CONVIDADOS */}
      <nav className={`sticky top-[45px] z-30 ${activeTheme.bgCard} ${activeTheme.border} border-b shadow-sm py-3 px-4 backdrop-blur-md bg-opacity-90`}>
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className={`${activeTheme.fontHeader} text-xl font-bold ${activeTheme.accentText}`}>
            {coupleData.monogram}
          </div>
          <div className="hidden md:flex space-x-6 text-xs uppercase tracking-wider font-medium text-slate-600">
            <button onClick={() => scrollToSection('inicio')} className="hover:text-slate-900 transition">Início</button>
            <button onClick={() => scrollToSection('historia')} className="hover:text-slate-900 transition">Nossa História</button>
            <button onClick={() => scrollToSection('local')} className="hover:text-slate-900 transition">Local e Horário</button>
            <button onClick={() => scrollToSection('dresscode')} className="hover:text-slate-900 transition">Dress Code</button>
            <button onClick={() => scrollToSection('rsvp')} className="hover:text-slate-900 transition">Confirmação</button>
            <button onClick={() => scrollToSection('presentes')} className="hover:text-slate-900 transition">Presentes</button>
            <button onClick={() => scrollToSection('mural')} className="hover:text-slate-900 transition">Mensagem</button>
          </div>
          <button 
            onClick={() => scrollToSection('rsvp')}
            className={`${activeTheme.accent} ${activeTheme.accentHover} text-white px-4 py-1.5 rounded-full text-xs font-medium transition shadow-sm`}
          >
            Confirmar Presença
          </button>
        </div>
      </nav>

      {/* SEÇÃO HERO / CABEÇALHO */}
      <section id="inicio" className="max-w-5xl mx-auto px-4 py-8">
        <div className={`${activeTheme.bgCard} ${activeTheme.border} border rounded-2xl p-6 md:p-10 shadow-sm flex flex-col md:flex-row items-center gap-8`}>
          <div className="w-full md:w-1/2 overflow-hidden rounded-xl shadow-md border border-amber-100/50">
            <img 
              src={coupleData.coverImage} 
              alt="Fotos dos Noivos" 
              className="w-full h-[320px] md:h-[400px] object-cover hover:scale-105 transition duration-500"
            />
          </div>
          <div className="w-full md:w-1/2 text-center md:text-left space-y-4">
            <div className={`${activeTheme.fontHeader} text-4xl md:text-5xl font-serif tracking-tight ${activeTheme.accentText}`}>
              {coupleData.monogram}
            </div>
            <p className="text-slate-600 italic text-sm md:text-base leading-relaxed">
              "Estamos muito felizes em compartilhar esse momento especial com você!"
            </p>
            <div className="py-2 border-y border-dashed border-slate-200">
              <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Nosso casamento será no dia</p>
              <p className="text-xl md:text-2xl font-serif font-bold text-slate-800 mt-1">
                {new Date(coupleData.weddingDate).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
              <p className="text-sm font-medium text-slate-500">
                às {new Date(coupleData.weddingDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <button 
              onClick={() => scrollToSection('rsvp')}
              className={`w-full md:w-auto ${activeTheme.accent} ${activeTheme.accentHover} text-white px-8 py-3 rounded-lg text-sm font-medium shadow-md transition transform hover:-translate-y-0.5 flex items-center justify-center gap-2`}
            >
              <CheckCircle size={16} /> Confirmar sua presença
            </button>
          </div>
        </div>
      </section>

      {/* HISTÓRIA DOS NOIVOS */}
      <section id="historia" className="max-w-5xl mx-auto px-4 py-8">
        <div className={`${activeTheme.bgCard} ${activeTheme.border} border rounded-2xl p-6 md:p-8 shadow-sm text-center max-w-3xl mx-auto`}>
          <Heart className={`mx-auto mb-3 ${activeTheme.accentText}`} size={28} />
          <h2 className={`${activeTheme.fontHeader} text-2xl md:text-3xl font-serif mb-4 text-slate-800`}>Nossa História</h2>
          <p className="text-slate-600 leading-relaxed text-sm md:text-base whitespace-pre-line">
            {coupleData.story}
          </p>
        </div>
      </section>

      {/* LOCAL E HORÁRIO */}
      <section id="local" className="max-w-5xl mx-auto px-4 py-8">
        <div className={`${activeTheme.bgCard} ${activeTheme.border} border rounded-2xl p-6 md:p-8 shadow-sm flex flex-col md:flex-row gap-6 items-center`}>
          <div className="w-full md:w-1/2 space-y-4">
            <div className="flex items-center gap-2 text-slate-700 font-serif text-xl font-semibold">
              <MapPin className={activeTheme.accentText} size={22} />
              <h3>Local e Horário</h3>
            </div>
            <div>
              <h4 className="font-bold text-slate-800 text-lg">{coupleData.locationName}</h4>
              <p className="text-slate-600 text-sm mt-1">{coupleData.address}</p>
            </div>
            <div className="text-xs text-slate-500 space-y-1">
              <p>• Início da cerimônia: {new Date(coupleData.weddingDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
              <p>• Recepção no mesmo local logo após a cerimônia.</p>
            </div>
            <div className="flex flex-wrap gap-3 pt-2">
              <a 
                href={`https://maps.google.com/?q=${encodeURIComponent(coupleData.address)}`} 
                target="_blank" 
                rel="noreferrer"
                className={`inline-flex items-center gap-1.5 ${activeTheme.accent} ${activeTheme.accentHover} text-white px-4 py-2 rounded-lg text-xs font-medium transition shadow-sm`}
              >
                <ExternalLink size={14} /> Ver no Google Maps
              </a>
            </div>
          </div>
          {/* Mapa simulado estilo UI elegante */}
          <div className="w-full md:w-1/2 h-52 bg-slate-200 rounded-xl overflow-hidden relative shadow-inner border border-slate-300 flex items-center justify-center">
            <img 
              src="https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&q=80&w=600" 
              alt="Mapa Ilustrativo" 
              className="w-full h-full object-cover opacity-80"
            />
            <div className="absolute inset-0 bg-black/20 flex flex-col items-center justify-center text-white">
              <MapPin size={36} className="text-red-500 animate-bounce drop-shadow" />
              <span className="bg-slate-900/80 px-3 py-1 rounded-full text-xs font-medium mt-1">
                {coupleData.locationName}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* DRESS CODE */}
      <section id="dresscode" className="max-w-5xl mx-auto px-4 py-8">
        <div className={`${activeTheme.bgCard} ${activeTheme.border} border rounded-2xl p-6 md:p-8 shadow-sm`}>
          <div className="text-center max-w-xl mx-auto mb-6">
            <h2 className={`${activeTheme.fontHeader} text-2xl font-serif text-slate-800`}>Dress Code</h2>
            <p className="text-slate-600 text-sm mt-1">Traje Social / Esporte Fino - Elegância e conforto para aproveitar cada momento conosco!</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Cores Proibidas */}
            <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-200/60">
              <h4 className="font-semibold text-xs uppercase tracking-wider text-amber-900 mb-3 flex items-center gap-1.5">
                <ShieldAlert size={16} className="text-amber-700" /> Cores Reservadas / Proibidas
              </h4>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-6 h-6 rounded-full bg-white border border-slate-300 shadow-sm" title="Branco"></span>
                  <span className="text-xs text-slate-700">Branco</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-6 h-6 rounded-full bg-[#FFFDD0] border border-slate-300 shadow-sm" title="Off-White/Creme"></span>
                  <span className="text-xs text-slate-700">Off-White/Creme</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-6 h-6 rounded-full bg-[#F5F5DC] border border-slate-300 shadow-sm" title="Marfim"></span>
                  <span className="text-xs text-slate-700">Marfim</span>
                </div>
              </div>
              <p className="text-[11px] text-amber-800 mt-2">
                Pedimos carinhosamente que as convidadas evitem tons de branco e bege claríssimo para exclusividade da noiva.
              </p>
            </div>

            {/* Trajes / Estilos Não Recomendados */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
              <h4 className="font-semibold text-xs uppercase tracking-wider text-slate-700 mb-2">
                Evite Trajes Excessivamente Informais
              </h4>
              <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside">
                <li>Roupas esportivas, bermudas ou regatas</li>
                <li>Tênis de corrida e chinelos</li>
                <li>Jeans muito rasgados ou casuais</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ÁREA DE CONFIRMAÇÃO DE PRESENÇA (RSVP INTELIGENTE) */}
      <section id="rsvp" className="max-w-5xl mx-auto px-4 py-8">
        <RsvpSection 
          activeTheme={activeTheme} 
          families={families} 
          setFamilies={setFamilies} 
        />
      </section>

      {/* ÁREA DE PRESENTES (PIX & COTAS) */}
      <section id="presentes" className="max-w-5xl mx-auto px-4 py-8">
        <GiftSection 
          activeTheme={activeTheme} 
          gifts={gifts} 
          setGifts={setGifts}
          coupleData={coupleData}
        />
      </section>

      {/* MURAL DE RECADOS */}
      <section id="mural" className="max-w-5xl mx-auto px-4 py-8">
        <MessageBoard 
          activeTheme={activeTheme} 
          guestMessages={guestMessages} 
          setGuestMessages={setGuestMessages} 
        />
      </section>

      {/* RODAPÉ */}
      <footer className="text-center text-xs text-slate-500 py-6 border-t border-slate-200 mt-12">
        <p>{coupleData.monogram} • Com muito carinho para os nossos convidados.</p>
      </footer>
    </div>
  );
}

/* --- COMPONENTE RSVP INTELIGENTE POR FAMÍLIA --- */
function RsvpSection({ activeTheme, families, setFamilies }) {
  const [searchName, setSearchName] = useState('');
  const [foundFamily, setFoundFamily] = useState(null);
  const [responsibleName, setResponsibleName] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [memberStatuses, setMemberStatuses] = useState({});
  const [rsvpFinished, setRsvpFinished] = useState(false);
  const [hasConfirmedAny, setHasConfirmedAny] = useState(false);

  // Busca o grupo familiar pelo nome digitado
  const handleSearch = (e) => {
    e.preventDefault();
    if (!searchName.trim()) return;

    const term = searchName.toLowerCase().trim();
    const family = families.find(f => 
      f.members.some(m => m.name.toLowerCase().includes(term))
    );

    if (family) {
      setFoundFamily(family);
      setResponsibleName(searchName);
      // Inicializa os status com o que já estiver salvo ou padrão true
      const initialMap = {};
      family.members.forEach(m => {
        initialMap[m.id] = m.confirmed !== null ? m.confirmed : true;
      });
      setMemberStatuses(initialMap);
      setRsvpFinished(false);
    } else {
      alert("Nome não encontrado na lista de convidados. Por favor, digite seu nome completo exatamente como enviado pelos noivos.");
    }
  };

  const handleToggleMember = (memberId, confirmed) => {
    setMemberStatuses(prev => ({
      ...prev,
      [memberId]: confirmed
    }));
  };

  const handleSubmitRsvp = () => {
    if (!foundFamily) return;

    const anyConfirmed = Object.values(memberStatuses).some(status => status === true);
    setHasConfirmedAny(anyConfirmed);

    // Atualiza o estado global de famílias
    const updatedFamilies = families.map(f => {
      if (f.id === foundFamily.id) {
        return {
          ...f,
          members: f.members.map(m => ({
            ...m,
            confirmed: memberStatuses[m.id] !== undefined ? memberStatuses[m.id] : false
          }))
        };
      }
      return f;
    });

    setFamilies(updatedFamilies);
    setRsvpFinished(true);
  };

  const handleGoogleCalendarSave = () => {
    const title = encodeURIComponent("Casamento Amanda & Rafael");
    const details = encodeURIComponent("Celebração do Casamento de Amanda e Rafael");
    const location = encodeURIComponent("Espaço Jardim das Flores, Gramado RS");
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=20261024T190000Z/20261024T235900Z&details=${details}&location=${location}`;
    window.open(url, '_blank');
  };

  return (
    <div className={`${activeTheme.bgCard} ${activeTheme.border} border rounded-2xl p-6 md:p-8 shadow-sm`}>
      <div className="text-center max-w-xl mx-auto mb-6">
        <Users className={`mx-auto mb-2 ${activeTheme.accentText}`} size={26} />
        <h2 className={`${activeTheme.fontHeader} text-2xl font-serif text-slate-800`}>Confirmação de Presença</h2>
        <p className="text-slate-600 text-sm mt-1">
          Digite seu nome completo para localizar seu convite e de sua família.
        </p>
      </div>

      {!foundFamily ? (
        <form onSubmit={handleSearch} className="max-w-md mx-auto space-y-3">
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600 mb-1">Nome Completo</label>
            <input 
              type="text" 
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              placeholder="Ex: Ana Clara Silva" 
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#4A5D4E] text-sm"
              required
            />
          </div>
          <button 
            type="submit"
            className={`w-full ${activeTheme.accent} ${activeTheme.accentHover} text-white py-2.5 rounded-lg text-sm font-medium shadow transition`}
          >
            Buscar Convite
          </button>
        </form>
      ) : !rsvpFinished ? (
        <div className="max-w-xl mx-auto space-y-6">
          <div className="bg-amber-50/60 p-3 rounded-lg border border-amber-200/80 text-xs text-amber-900 flex justify-between items-center">
            <span>Grupo/Família: <strong>{foundFamily.name}</strong></span>
            <button 
              onClick={() => setFoundFamily(null)} 
              className="text-slate-500 hover:text-slate-800 text-[11px] underline"
            >
              Trocar nome
            </button>
          </div>

          <div className="space-y-3">
            <h4 className="font-semibold text-xs uppercase tracking-wider text-slate-700">
              Selecione a presença de cada convidado:
            </h4>
            {foundFamily.members.map(member => (
              <div 
                key={member.id} 
                className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition"
              >
                <div>
                  <p className="font-semibold text-sm text-slate-800">{member.name}</p>
                  {member.isChild && (
                    <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
                      Criança ({member.age} anos)
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleMember(member.id, true)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1 ${
                      memberStatuses[member.id] === true
                        ? 'bg-emerald-700 text-white shadow-sm'
                        : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <CheckCircle size={13} /> Vou
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleMember(member.id, false)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1 ${
                      memberStatuses[member.id] === false
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <X size={13} /> Não vou
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Dados de Contato e Responsável */}
          <div className="space-y-3 pt-2 border-t border-slate-200">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Responsável pela Confirmação
              </label>
              <input 
                type="text" 
                value={responsibleName} 
                onChange={(e) => setResponsibleName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-slate-100 text-slate-600"
                readOnly
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                E-mail ou WhatsApp (para envio do comprovante de confirmação)
              </label>
              <input 
                type="text" 
                value={contactInfo}
                onChange={(e) => setContactInfo(e.target.value)}
                placeholder="ex: contato@email.com ou (54) 99999-0000"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A5D4E]"
                required
              />
            </div>
          </div>

          <button
            onClick={handleSubmitRsvp}
            className={`w-full ${activeTheme.accent} ${activeTheme.accentHover} text-white py-3 rounded-xl font-medium text-sm shadow-md transition`}
          >
            Salvar Confirmação
          </button>
        </div>
      ) : (
        /* TELA DE CONCLUSÃO DO RSVP */
        <div className="max-w-md mx-auto text-center space-y-4 py-4">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle size={28} />
          </div>
          <h3 className="font-serif text-xl font-bold text-slate-800">
            {hasConfirmedAny ? 'Presença Confirmada com Sucesso!' : 'Resposta Registrada'}
          </h3>
          <p className="text-slate-600 text-xs leading-relaxed">
            {hasConfirmedAny 
              ? `Obrigado, ${responsibleName}! Registramos a confirmação da sua família. Enviamos um comprovante para ${contactInfo || 'seu contato'}.`
              : `Agradecemos por nos avisar, ${responsibleName}. Sentiremos sua falta nesse dia tão especial.`
            }
          </p>

          {hasConfirmedAny && (
            <div className="pt-2">
              <button
                onClick={handleGoogleCalendarSave}
                className="w-full bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 py-2.5 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-2"
              >
                <Calendar size={15} className="text-blue-600" /> Salvar no Google Agenda
              </button>
            </div>
          )}

          <button
            onClick={() => setFoundFamily(null)}
            className="text-xs text-slate-500 hover:text-slate-800 underline block mx-auto pt-2"
          >
            Fazer outra confirmação
          </button>
        </div>
      )}
    </div>
  );
}

/* --- COMPONENTE DE PRESENTES COM PIX E COTAS --- */
function GiftSection({ activeTheme, gifts, setGifts, coupleData }) {
  const [selectedGift, setSelectedGift] = useState(null);
  const [quotasToBuy, setQuotasToBuy] = useState(1);
  const [pixModalOpen, setPixModalOpen] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [reservedSuccess, setReservedSuccess] = useState(false);

  const handleOpenGift = (gift) => {
    setSelectedGift(gift);
    setQuotasToBuy(1);
    setPixModalOpen(true);
    setCopySuccess(false);
    setReservedSuccess(false);
  };

  const calculateAmount = () => {
    if (!selectedGift) return 0;
    const unitPrice = selectedGift.price / (selectedGift.totalQuotas || 1);
    return unitPrice * quotasToBuy;
  };

  const handleConfirmPixPayment = () => {
    if (!selectedGift) return;

    const updatedGifts = gifts.map(g => {
      if (g.id === selectedGift.id) {
        return {
          ...g,
          takenQuotas: Math.min(g.totalQuotas, g.takenQuotas + quotasToBuy)
        };
      }
      return g;
    });

    setGifts(updatedGifts);
    alert("Pagamento simulado registrado! Os noivos agradecem de coração!");
    setPixModalOpen(false);
  };

  const handleReserveGift = () => {
    setReservedSuccess(true);
    setTimeout(() => {
      setPixModalOpen(false);
      setReservedSuccess(false);
    }, 2500);
  };

  return (
    <div className={`${activeTheme.bgCard} ${activeTheme.border} border rounded-2xl p-6 md:p-8 shadow-sm`}>
      <div className="text-center max-w-xl mx-auto mb-8">
        <Gift className={`mx-auto mb-2 ${activeTheme.accentText}`} size={28} />
        <h2 className={`${activeTheme.fontHeader} text-2xl font-serif text-slate-800`}>Lista de Presentes (PIX)</h2>
        <p className="text-slate-600 text-sm mt-1">
          Sua presença é o maior presente! Se desejar nos presentear, escolha um item abaixo. Todos os presentes são convertidos em PIX direto para o casal.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {gifts.map((gift) => {
          const isSoldOut = gift.takenQuotas >= gift.totalQuotas;
          const remainingQuotas = gift.totalQuotas - gift.takenQuotas;
          const quotaPrice = gift.price / gift.totalQuotas;

          return (
            <div 
              key={gift.id} 
              className={`border rounded-xl overflow-hidden bg-white shadow-sm flex flex-col justify-between transition hover:shadow-md ${
                isSoldOut ? 'opacity-75 bg-slate-50' : ''
              }`}
            >
              <div>
                <div className="h-44 overflow-hidden relative bg-slate-100">
                  <img 
                    src={gift.image} 
                    alt={gift.title} 
                    className="w-full h-full object-cover"
                  />
                  {isSoldOut && (
                    <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center">
                      <span className="bg-emerald-600 text-white font-bold text-xs uppercase tracking-wider px-3 py-1 rounded-full shadow">
                        Presenteado! ♡
                      </span>
                    </div>
                  )}
                  {gift.totalQuotas > 1 && !isSoldOut && (
                    <span className="absolute top-2 right-2 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow">
                      Cotas ({gift.takenQuotas}/{gift.totalQuotas})
                    </span>
                  )}
                </div>

                <div className="p-4">
                  <h3 className="font-semibold text-slate-800 text-sm mb-1 line-clamp-1">{gift.title}</h3>
                  <div className="flex items-baseline justify-between mt-2">
                    <span className="text-xs text-slate-500">Valor:</span>
                    <span className="font-serif font-bold text-slate-900 text-base">
                      R$ {gift.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  {gift.totalQuotas > 1 && (
                    <p className="text-[11px] text-slate-500 text-right">
                      (R$ {quotaPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} por cota)
                    </p>
                  )}
                </div>
              </div>

              <div className="p-4 pt-0">
                <button
                  disabled={isSoldOut}
                  onClick={() => handleOpenGift(gift)}
                  className={`w-full py-2 rounded-lg text-xs font-semibold transition ${
                    isSoldOut
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : `${activeTheme.accent} ${activeTheme.accentHover} text-white shadow`
                  }`}
                >
                  {isSoldOut ? 'Esgotado / Presenteado' : 'Presentear via PIX'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL DE PAGAMENTO PIX / RESERVA */}
      {pixModalOpen && selectedGift && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative space-y-4 animate-in fade-in zoom-in duration-200">
            <button 
              onClick={() => setPixModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <X size={20} />
            </button>

            {!reservedSuccess ? (
              <>
                <div className="text-center">
                  <h3 className="font-serif text-lg font-bold text-slate-800">{selectedGift.title}</h3>
                  <p className="text-xs text-slate-500 mt-1">Sua contribuição vai direto para a conta dos noivos.</p>
                </div>

                {/* Seleção de Cotas se houver */}
                {selectedGift.totalQuotas > 1 && (
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Selecione a quantidade de cotas:
                    </label>
                    <select
                      value={quotasToBuy}
                      onChange={(e) => setQuotasToBuy(Number(e.target.value))}
                      className="w-full text-xs p-2 rounded border border-slate-300"
                    >
                      {[...Array(selectedGift.totalQuotas - selectedGift.takenQuotas)].map((_, i) => (
                        <option key={i + 1} value={i + 1}>
                          {i + 1} cota(s) - R$ {((selectedGift.price / selectedGift.totalQuotas) * (i + 1)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="text-center py-2 bg-amber-50 rounded-xl border border-amber-200">
                  <span className="text-xs text-amber-900 font-medium">Total a contribuir:</span>
                  <p className="text-2xl font-serif font-bold text-amber-900">
                    R$ {calculateAmount().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>

                {/* Simulador de QR Code PIX */}
                <div className="flex flex-col items-center justify-center space-y-2 py-2">
                  <div className="w-36 h-36 bg-slate-900 rounded-lg flex items-center justify-center p-2 shadow-inner">
                    <div className="w-full h-full bg-white p-2 rounded flex flex-col items-center justify-center text-[10px] text-center font-mono">
                      [QR CODE PIX]
                      <br />
                      00020126580014BR.GOV.BCB.PIX
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText("00020126580014BR.GOV.BCB.PIX0136amandaerafael@pix.com.br");
                      setCopySuccess(true);
                      setTimeout(() => setCopySuccess(false), 2000);
                    }}
                    className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1 font-medium bg-slate-100 px-3 py-1.5 rounded border border-slate-300"
                  >
                    {copySuccess ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                    {copySuccess ? 'Copia e Cola Copiado!' : 'Copiar Chave Copia e Cola'}
                  </button>
                </div>

                <div className="space-y-2 pt-2">
                  <button
                    onClick={handleConfirmPixPayment}
                    className="w-full bg-emerald-700 hover:bg-emerald-800 text-white py-2.5 rounded-lg text-xs font-semibold shadow transition"
                  >
                    Já paguei via PIX
                  </button>
                  <button
                    onClick={handleReserveGift}
                    className="w-full bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 py-2 rounded-lg text-xs font-medium transition"
                  >
                    Reservar para pagar depois (Lembrete por E-mail/WhatsApp)
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-8 space-y-3">
                <CheckCircle size={40} className="text-amber-600 mx-auto" />
                <h4 className="font-bold text-slate-800">Presente Reservado com Sucesso!</h4>
                <p className="text-xs text-slate-600">
                  Enviamos as instruções e a chave PIX para o seu e-mail e WhatsApp cadastrados.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* --- MURAL DE RECADOS DOS CONVIDADOS --- */
function MessageBoard({ activeTheme, guestMessages, setGuestMessages }) {
  const [author, setAuthor] = useState('');
  const [text, setText] = useState('');

  const handleAddMessage = (e) => {
    e.preventDefault();
    if (!author.trim() || !text.trim()) return;

    const newMessage = {
      id: Date.now().toString(),
      name: author,
      text: text,
      date: new Date().toLocaleDateString('pt-BR')
    };

    setGuestMessages([newMessage, ...guestMessages]);
    setAuthor('');
    setText('');
  };

  return (
    <div className={`${activeTheme.bgCard} ${activeTheme.border} border rounded-2xl p-6 md:p-8 shadow-sm`}>
      <div className="text-center max-w-xl mx-auto mb-6">
        <MessageSquare className={`mx-auto mb-2 ${activeTheme.accentText}`} size={26} />
        <h2 className={`${activeTheme.fontHeader} text-2xl font-serif text-slate-800`}>Mural de Recados</h2>
        <p className="text-slate-600 text-sm mt-1">Deixe uma mensagem carinhosa para os noivos!</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Formulário para deixar mensagem */}
        <form onSubmit={handleAddMessage} className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Seu Nome</label>
            <input 
              type="text" 
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Ex: Tio João" 
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A5D4E]"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Sua Mensagem</label>
            <textarea 
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Escreva seus votos aos noivos..." 
              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A5D4E]"
              required
            />
          </div>
          <button 
            type="submit"
            className={`w-full ${activeTheme.accent} ${activeTheme.accentHover} text-white py-2 rounded-lg text-xs font-semibold shadow transition flex items-center justify-center gap-1.5`}
          >
            <Send size={14} /> Publicar Mensagem
          </button>
        </form>

        {/* Lista de mensagens publicadas */}
        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {guestMessages.map((msg) => (
            <div key={msg.id} className="bg-amber-50/40 p-3.5 rounded-xl border border-amber-100 space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-800">{msg.name}</span>
                <span className="text-slate-400 text-[10px]">{msg.date}</span>
              </div>
              <p className="text-xs text-slate-600 italic">"{msg.text}"</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


/* =========================================================================
   2. PAINEL DOS NOIVOS (ADMIN DASHBOARD VIEW WITH SIDEBAR)
   ========================================================================= */
function AdminDashboardView({ 
  coupleData, 
  setCoupleData, 
  activeTheme,
  families, 
  setFamilies, 
  gifts, 
  setGifts,
  tasks,
  setTasks,
  financials,
  setFinancials,
  setShowConfetti
}) {
  const [activeAdminTab, setActiveAdminTab] = useState('inicio');

  return (
    <div className="flex flex-col md:flex-row min-h-[calc(100vh-45px)] bg-slate-100">
      {/* SIDEBAR DO PAINEL */}
      <aside className="w-full md:w-64 bg-slate-900 text-slate-300 p-4 border-r border-slate-800 flex flex-col justify-between">
        <div className="space-y-6">
          <div className="px-2 pt-2">
            <div className="font-serif text-2xl font-bold text-amber-400 tracking-wider">
              {coupleData.monogram}
            </div>
            <p className="text-[11px] text-slate-400">Painel dos Noivos</p>
          </div>

          <nav className="space-y-1">
            <SidebarButton 
              active={activeAdminTab === 'inicio'} 
              onClick={() => setActiveAdminTab('inicio')}
              icon={<Layout size={16} />}
              label="Início"
            />
            <SidebarButton 
              active={activeAdminTab === 'dados'} 
              onClick={() => setActiveAdminTab('dados')}
              icon={<User size={16} />}
              label="Dados do Casal"
            />
            <SidebarButton 
              active={activeAdminTab === 'contagem'} 
              onClick={() => setActiveAdminTab('contagem')}
              icon={<Clock size={16} />}
              label="Contagem Regressiva"
            />
            <SidebarButton 
              active={activeAdminTab === 'tarefas'} 
              onClick={() => setActiveAdminTab('tarefas')}
              icon={<CheckSquare size={16} />}
              label="Tarefas / Checklist"
            />
            <SidebarButton 
              active={activeAdminTab === 'convidados'} 
              onClick={() => setActiveAdminTab('convidados')}
              icon={<Users size={16} />}
              label="Convidados"
            />
            <SidebarButton 
              active={activeAdminTab === 'presentes'} 
              onClick={() => setActiveAdminTab('presentes')}
              icon={<Gift size={16} />}
              label="Presentes"
            />
            <SidebarButton 
              active={activeAdminTab === 'financeiro'} 
              onClick={() => setActiveAdminTab('financeiro')}
              icon={<DollarSign size={16} />}
              label="Controle Financeiro"
            />
            <SidebarButton 
              active={activeAdminTab === 'estilizacao'} 
              onClick={() => setActiveAdminTab('estilizacao')}
              icon={<Palette size={16} />}
              label="Estilização do Site"
            />
          </nav>
        </div>

        <div className="pt-6 border-t border-slate-800 text-xs text-slate-500">
          Logado como: <br />
          <strong className="text-slate-300">{coupleData.email}</strong>
        </div>
      </aside>

      {/* ÁREA DE CONTEÚDO PRINCIPAL DO PAINEL */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        {activeAdminTab === 'inicio' && (
          <AdminOverviewTab 
            coupleData={coupleData}
            families={families}
            gifts={gifts}
            financials={financials}
            tasks={tasks}
            setActiveAdminTab={setActiveAdminTab}
            setShowConfetti={setShowConfetti}
          />
        )}
        {activeAdminTab === 'dados' && (
          <CoupleDataTab coupleData={coupleData} setCoupleData={setCoupleData} />
        )}
        {activeAdminTab === 'contagem' && (
          <CountdownTab coupleData={coupleData} setShowConfetti={setShowConfetti} />
        )}
        {activeAdminTab === 'tarefas' && (
          <TasksTab tasks={tasks} setTasks={setTasks} />
        )}
        {activeAdminTab === 'convidados' && (
          <GuestsTab families={families} setFamilies={setFamilies} coupleData={coupleData} setCoupleData={setCoupleData} />
        )}
        {activeAdminTab === 'presentes' && (
          <GiftsAdminTab gifts={gifts} setGifts={setGifts} />
        )}
        {activeAdminTab === 'financeiro' && (
          <FinancialsTab financials={financials} setFinancials={setFinancials} />
        )}
        {activeAdminTab === 'estilizacao' && (
          <StylingTab coupleData={coupleData} setCoupleData={setCoupleData} />
        )}
      </main>
    </div>
  );
}

function SidebarButton({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition ${
        active 
          ? 'bg-[#4A5D4E] text-white shadow-sm' 
          : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

/* --- SUB-ABA: RESUMO DO PAINEL (INÍCIO) --- */
function AdminOverviewTab({ coupleData, families, gifts, financials, tasks, setActiveAdminTab, setShowConfetti }) {
  // Cálculos de resumo
  const allMembers = families.flatMap(f => f.members);
  const guests = allMembers.filter(m => !isNonPayingChild(m, coupleData.buffetPayingAge));
  const totalGuests = guests.length;
  const confirmedGuests = guests.filter(m => m.confirmed === true).length;
  const unconfirmedGuests = guests.filter(m => m.confirmed === null || m.confirmed === undefined).length;

  const totalGiftsValue = gifts.reduce((acc, g) => acc + (g.price * (g.takenQuotas / g.totalQuotas)), 0);

  const totalFinancialAgreed = financials.suppliers.reduce((acc, s) => acc + s.agreedValue, 0);
  const totalFinancialPaid = financials.suppliers.flatMap(s => s.installments).filter(i => i.paid).reduce((acc, i) => acc + i.value, 0);

  const completedTasks = tasks.filter(t => t.completed).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-slate-800">
            Olá, {coupleData.bride} e {coupleData.groom}! ♡
          </h1>
          <p className="text-xs text-slate-500">Tudo o que vocês precisam em um só lugar.</p>
        </div>
        <button
          onClick={() => setShowConfetti(true)}
          className="bg-amber-100 text-amber-800 hover:bg-amber-200 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border border-amber-300 shadow-sm w-fit"
        >
          <Sparkles size={14} /> Soltar Confetes
        </button>
      </div>

      {/* BANNER FRASE + CONTAGEM REGRESSIVA MINI */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl p-6 shadow-md flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-1 text-center md:text-left">
          <span className="text-[10px] uppercase tracking-widest text-amber-400 font-semibold">Mensagem do Dia</span>
          <p className="font-serif italic text-lg md:text-xl text-slate-200">"O melhor ainda está por vir..."</p>
        </div>
        <div className="flex gap-4 text-center bg-slate-800/80 p-3 rounded-xl border border-slate-700">
          <CountdownUnit label="dias" value={312} />
          <CountdownUnit label="horas" value={14} />
          <CountdownUnit label="minutos" value={23} />
          <CountdownUnit label="segundos" value={45} />
        </div>
      </div>

      {/* CARDS RESUMO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <OverviewCard
          icon={<Users className="text-emerald-600" size={20} />}
          title="Convidados"
          value={`${confirmedGuests} / ${totalGuests}`}
          subtitle={`${unconfirmedGuests} não confirmados`}
          onClick={() => setActiveAdminTab('convidados')}
        />
        <OverviewCard
          icon={<Gift className="text-amber-600" size={20} />}
          title="Presentes Recebidos"
          value={`R$ ${totalGiftsValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          subtitle={`${gifts.filter(g => g.takenQuotas > 0).length} itens escolhidos`}
          onClick={() => setActiveAdminTab('presentes')}
        />
        <OverviewCard
          icon={<DollarSign className="text-blue-600" size={20} />}
          title="Financeiro Fechado"
          value={`R$ ${totalFinancialAgreed.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          subtitle={`R$ ${(totalFinancialAgreed - totalFinancialPaid).toLocaleString('pt-BR')} a pagar`}
          onClick={() => setActiveAdminTab('financeiro')}
        />
        <OverviewCard
          icon={<CheckSquare className="text-purple-600" size={20} />}
          title="Tarefas"
          value={`${completedTasks} / ${tasks.length}`}
          subtitle={`${Math.round((completedTasks/tasks.length)*100)}% concluídas`}
          onClick={() => setActiveAdminTab('tarefas')}
        />
      </div>

      {/* PREVIEWS RÁPIDOS DA DASHBOARD */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* RESUMO TAREFAS */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-serif font-bold text-slate-800 text-sm">Próximas Tarefas</h3>
            <button onClick={() => setActiveAdminTab('tarefas')} className="text-xs text-[#4A5D4E] font-medium hover:underline">Ver todas</button>
          </div>
          <div className="space-y-2">
            {tasks.slice(0, 4).map(t => (
              <div key={t.id} className="flex items-center justify-between text-xs p-2 bg-slate-50 rounded border border-slate-100">
                <span className={t.completed ? 'line-through text-slate-400' : 'text-slate-700'}>{t.title}</span>
                <span className="text-[10px] text-slate-400">{t.category}</span>
              </div>
            ))}
          </div>
        </div>

        {/* RESUMO FINANCEIRO */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-serif font-bold text-slate-800 text-sm">Resumo Financeiro</h3>
            <button onClick={() => setActiveAdminTab('financeiro')} className="text-xs text-[#4A5D4E] font-medium hover:underline">Ver detalhes</button>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-600">Meta de Gastos:</span>
              <span className="font-semibold">R$ {financials.targetBudget.toLocaleString('pt-BR')}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-600">Total Contratado:</span>
              <span className="font-semibold text-blue-700">R$ {totalFinancialAgreed.toLocaleString('pt-BR')}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-600">Total Pago até o Momento:</span>
              <span className="font-semibold text-emerald-700">R$ {totalFinancialPaid.toLocaleString('pt-BR')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function OverviewCard({ icon, title, value, subtitle, onClick }) {
  return (
    <div 
      onClick={onClick}
      className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition cursor-pointer flex flex-col justify-between"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-500 uppercase">{title}</span>
        <div className="p-2 bg-slate-50 rounded-xl">{icon}</div>
      </div>
      <div>
        <div className="text-xl font-bold font-serif text-slate-800">{value}</div>
        <p className="text-[11px] text-slate-400 mt-1">{subtitle}</p>
      </div>
    </div>
  );
}

function CountdownUnit({ label, value }) {
  return (
    <div>
      <div className="text-xl md:text-2xl font-bold text-amber-300 font-mono">{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-slate-400">{label}</div>
    </div>
  );
}

/* --- SUB-ABA: DADOS DO CASAL & CONFIGURAÇÕES --- */
function CoupleDataTab({ coupleData, setCoupleData }) {
  const [formData, setFormData] = useState({ ...coupleData });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setCoupleData(formData);
    alert("Dados do casal atualizados com sucesso!");
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm max-w-2xl mx-auto space-y-6">
      <h2 className="text-xl font-serif font-bold text-slate-800">Dados Principais do Casamento</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nome do Noivo</label>
            <input 
              type="text" 
              name="groom"
              value={formData.groom} 
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nome da Noiva</label>
            <input 
              type="text" 
              name="bride"
              value={formData.bride} 
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Monograma</label>
            <input 
              type="text" 
              name="monogram"
              value={formData.monogram} 
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">E-mail Cadastrado</label>
            <input 
              type="email" 
              name="email"
              value={formData.email} 
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Data e Horário</label>
            <input 
              type="datetime-local" 
              name="weddingDate"
              value={formData.weddingDate} 
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Cerimonialista</label>
            <input 
              type="text" 
              name="ceremonialist"
              value={formData.ceremonialist} 
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Nome do Local</label>
          <input 
            type="text" 
            name="locationName"
            value={formData.locationName} 
            onChange={handleChange}
            className="w-full px-3 py-2 border rounded-lg text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Endereço Completo</label>
          <input 
            type="text" 
            name="address"
            value={formData.address} 
            onChange={handleChange}
            className="w-full px-3 py-2 border rounded-lg text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">História do Casal</label>
          <textarea 
            name="story"
            rows={4}
            value={formData.story} 
            onChange={handleChange}
            className="w-full px-3 py-2 border rounded-lg text-sm"
          />
        </div>

        <button 
          type="submit"
          className="bg-[#4A5D4E] hover:bg-[#364539] text-white px-6 py-2.5 rounded-lg text-xs font-semibold shadow transition"
        >
          Salvar Alterações
        </button>
      </form>
    </div>
  );
}

/* --- SUB-ABA: CONTAGEM REGRESSIVA --- */
function CountdownTab({ coupleData, setShowConfetti }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm max-w-xl mx-auto text-center space-y-6">
      <Clock size={36} className="text-[#4A5D4E] mx-auto" />
      <h2 className="text-2xl font-serif font-bold text-slate-800">Contagem Regressiva para o Grande Dia</h2>
      
      <div className="bg-amber-50 p-6 rounded-2xl border border-amber-200 flex justify-center gap-6">
        <CountdownUnit label="Dias" value={312} />
        <CountdownUnit label="Horas" value={14} />
        <CountdownUnit label="Minutos" value={23} />
        <CountdownUnit label="Segundos" value={45} />
      </div>

      <p className="text-xs text-slate-500">
        Data do Casamento: <strong>{new Date(coupleData.weddingDate).toLocaleDateString('pt-BR')}</strong>
      </p>

      <button
        onClick={() => setShowConfetti(true)}
        className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-2 rounded-lg text-xs font-semibold shadow transition inline-flex items-center gap-2"
      >
        <Sparkles size={16} /> Testar Efeito de Confetes do Dia
      </button>
    </div>
  );
}

/* --- SUB-ABA: CHECKLIST / TAREFAS --- */
function TasksTab({ tasks, setTasks }) {
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskCategory, setNewTaskCategory] = useState('6 meses antes');

  const handleToggleTask = (id) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const handleAddTask = (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const newTask = {
      id: Date.now().toString(),
      title: newTaskTitle,
      category: newTaskCategory,
      completed: false
    };

    setTasks([...tasks, newTask]);
    setNewTaskTitle('');
  };

  const handleDeleteTask = (id) => {
    setTasks(tasks.filter(t => t.id !== id));
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm max-w-3xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-serif font-bold text-slate-800">Checklist Automático do Casamento</h2>
        <span className="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-full font-medium">
          {tasks.filter(t => t.completed).length} / {tasks.length} concluídas
        </span>
      </div>

      {/* Formulário para Adicionar Tarefa */}
      <form onSubmit={handleAddTask} className="flex gap-2">
        <input 
          type="text" 
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          placeholder="Adicionar nova tarefa personalizada..."
          className="flex-1 px-3 py-2 border rounded-lg text-xs"
        />
        <select
          value={newTaskCategory}
          onChange={(e) => setNewTaskCategory(e.target.value)}
          className="px-3 py-2 border rounded-lg text-xs"
        >
          <option value="12 meses antes">12 meses antes</option>
          <option value="10 meses antes">10 meses antes</option>
          <option value="8 meses antes">8 meses antes</option>
          <option value="6 meses antes">6 meses antes</option>
          <option value="3 meses antes">3 meses antes</option>
          <option value="1 mês antes">1 mês antes</option>
        </select>
        <button 
          type="submit"
          className="bg-[#4A5D4E] hover:bg-[#364539] text-white px-4 py-2 rounded-lg text-xs font-semibold"
        >
          <Plus size={16} />
        </button>
      </form>

      {/* Lista de Tarefas por Categoria */}
      <div className="space-y-3">
        {tasks.map(task => (
          <div 
            key={task.id} 
            className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition"
          >
            <div className="flex items-center gap-3">
              <button onClick={() => handleToggleTask(task.id)} className="text-[#4A5D4E]">
                {task.completed ? <CheckCircle size={18} className="text-emerald-600" /> : <Circle size={18} className="text-slate-400" />}
              </button>
              <span className={`text-xs ${task.completed ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                {task.title}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded">
                {task.category}
              </span>
              <button onClick={() => handleDeleteTask(task.id)} className="text-slate-400 hover:text-rose-600">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* --- SUB-ABA: LISTA DE CONVIDADOS & FAMÍLIAS --- */
function GuestsTab({ families, setFamilies, coupleData, setCoupleData }) {
  const [newFamilyName, setNewFamilyName] = useState('');
  const [newFamilyPhone, setNewFamilyPhone] = useState('');

  const handleAddFamily = (e) => {
    e.preventDefault();
    if (!newFamilyName.trim()) return;

    const newFamily = {
      id: Date.now().toString(),
      name: newFamilyName,
      phone: newFamilyPhone,
      members: []
    };

    setFamilies([...families, newFamily]);
    setNewFamilyName('');
    setNewFamilyPhone('');
  };

  const handleAddMember = (familyId, name, isChild, age) => {
    if (!name.trim()) return;

    const updatedFamilies = families.map(f => {
      if (f.id === familyId) {
        return {
          ...f,
          members: [
            ...f.members,
            { id: Date.now().toString(), name, isChild, age: Number(age) || 0, confirmed: null }
          ]
        };
      }
      return f;
    });

    setFamilies(updatedFamilies);
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-serif font-bold text-slate-800">Gerenciador de Convidados</h2>
          <p className="text-xs text-slate-500">Organize convidados por famílias e gerencie pagantes do buffet.</p>
        </div>

        <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-200 text-xs flex items-center gap-2">
          <span>Idade pagante buffet: <strong>{coupleData.buffetPayingAge}+ anos</strong></span>
          <input 
            type="number" 
            value={coupleData.buffetPayingAge}
            onChange={(e) => setCoupleData({ ...coupleData, buffetPayingAge: Number(e.target.value) })}
            className="w-12 text-center border rounded p-0.5 text-xs bg-white"
          />
        </div>
      </div>

      {/* Cadastro de Nova Família */}
      <form onSubmit={handleAddFamily} className="flex gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
        <input 
          type="text" 
          placeholder="Nome da Família / Grupo (ex: Família Costa)"
          value={newFamilyName}
          onChange={(e) => setNewFamilyName(e.target.value)}
          className="flex-1 px-3 py-1.5 border rounded text-xs"
          required
        />
        <input 
          type="text" 
          placeholder="WhatsApp Principal"
          value={newFamilyPhone}
          onChange={(e) => setNewFamilyPhone(e.target.value)}
          className="w-40 px-3 py-1.5 border rounded text-xs"
        />
        <button type="submit" className="bg-[#4A5D4E] hover:bg-[#364539] text-white px-3 py-1.5 rounded text-xs font-semibold">
          + Criar Grupo
        </button>
      </form>

      {/* Lista de Grupos e Famílias */}
      <div className="space-y-4">
        {families.map(family => {
          const payingMembers = family.members.filter(m => !m.isChild || m.age >= coupleData.buffetPayingAge);
          const freeChildren = family.members.filter(m => m.isChild && m.age < coupleData.buffetPayingAge);
          const familyGuests = family.members.filter(m => !isNonPayingChild(m, coupleData.buffetPayingAge));
          const confirmedCount = familyGuests.filter(m => m.confirmed === true).length;

          return (
            <div key={family.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50/30 space-y-3">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">{family.name}</h4>
                  <p className="text-[11px] text-slate-500">
                    {payingMembers.length} pagantes • {freeChildren.length} crianças não-pagantes | Tel: {family.phone || 'Não informado'}
                  </p>
                </div>
                <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-full">
                  {confirmedCount} / {familyGuests.length} convidados confirmados
                </span>
              </div>

              {/* Membros da Família */}
              <div className="space-y-1.5 pl-2">
                {family.members.map(m => (
                  <div key={m.id} className="flex justify-between items-center text-xs bg-white p-2 rounded border border-slate-100">
                    <div>
                      <span className="font-semibold text-slate-700">{m.name}</span>
                      {m.isChild && (
                        <span className="ml-2 text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                          {m.age < coupleData.buffetPayingAge ? `Não-pagante (${m.age} anos)` : `Pagante (${m.age} anos)`}
                        </span>
                      )}
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      m.confirmed === true ? 'bg-emerald-100 text-emerald-800' :
                      m.confirmed === false ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {m.confirmed === true ? 'CONFIRMADO' : m.confirmed === false ? 'NÃO VAI' : 'PENDENTE'}
                    </span>
                  </div>
                ))}
              </div>

              {/* Adicionar Membro nesta Família */}
              <AddMemberForm onAdd={(name, isChild, age) => handleAddMember(family.id, name, isChild, age)} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AddMemberForm({ onAdd }) {
  const [name, setName] = useState('');
  const [isChild, setIsChild] = useState(false);
  const [age, setAge] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onAdd(name, isChild, age);
    setName('');
    setIsChild(false);
    setAge('');
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 pt-1 text-xs">
      <input 
        type="text" 
        placeholder="+ Nome do membro" 
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="px-2 py-1 border rounded text-xs flex-1 bg-white"
        required
      />
      <label className="flex items-center gap-1 text-[11px] text-slate-600">
        <input 
          type="checkbox" 
          checked={isChild} 
          onChange={(e) => setIsChild(e.target.checked)} 
        /> Criança
      </label>
      {isChild && (
        <input 
          type="number" 
          placeholder="Idade" 
          value={age}
          onChange={(e) => setAge(e.target.value)}
          className="w-14 px-2 py-1 border rounded text-xs bg-white"
        />
      )}
      <button type="submit" className="bg-slate-700 text-white px-2.5 py-1 rounded text-[11px]">
        Adicionar
      </button>
    </form>
  );
}

/* --- SUB-ABA: GERENCIADOR DE PRESENTES --- */
function GiftsAdminTab({ gifts, setGifts }) {
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [totalQuotas, setTotalQuotas] = useState(1);
  const [image, setImage] = useState('');

  const handleAddGift = (e) => {
    e.preventDefault();
    if (!title.trim() || !price) return;

    const newGift = {
      id: Date.now().toString(),
      title,
      price: Number(price),
      totalQuotas: Number(totalQuotas) || 1,
      takenQuotas: 0,
      image: image || 'https://images.unsplash.com/photo-1513885535751-8b9238bd345a?auto=format&fit=crop&q=80&w=400',
      givenBy: null
    };

    setGifts([...gifts, newGift]);
    setTitle('');
    setPrice('');
    setTotalQuotas(1);
    setImage('');
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm max-w-4xl mx-auto space-y-6">
      <h2 className="text-xl font-serif font-bold text-slate-800">Gerenciador de Presentes & Cotas PIX</h2>

      {/* Form de Adicionar Presente */}
      <form onSubmit={handleAddGift} className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
        <div>
          <label className="block text-[11px] font-semibold text-slate-700 mb-1">Título do Presente</label>
          <input 
            type="text" 
            placeholder="Ex: Jogo de Cama" 
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full p-2 border rounded text-xs" 
            required 
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-700 mb-1">Valor Total (R$)</label>
          <input 
            type="number" 
            placeholder="Ex: 300" 
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full p-2 border rounded text-xs" 
            required 
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-700 mb-1">Qtd Cotas</label>
          <input 
            type="number" 
            value={totalQuotas}
            onChange={(e) => setTotalQuotas(e.target.value)}
            className="w-full p-2 border rounded text-xs" 
            min="1" 
          />
        </div>
        <div className="flex items-end">
          <button type="submit" className="w-full bg-[#4A5D4E] hover:bg-[#364539] text-white p-2 rounded text-xs font-semibold">
            + Adicionar Presente
          </button>
        </div>
      </form>

      {/* Tabela de Presentes Cadastrados */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider">
              <th className="py-2">Item</th>
              <th className="py-2">Valor Total</th>
              <th className="py-2">Cotas</th>
              <th className="py-2">Status / Quem deu</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {gifts.map(g => (
              <tr key={g.id}>
                <td className="py-2.5 font-semibold text-slate-800">{g.title}</td>
                <td className="py-2.5">R$ {g.price.toLocaleString('pt-BR')}</td>
                <td className="py-2.5">{g.takenQuotas} / {g.totalQuotas}</td>
                <td className="py-2.5 text-slate-600">{g.givenBy || (g.takenQuotas > 0 ? 'Reservado' : 'Disponível')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* --- SUB-ABA: CONTROLE FINANCEIRO --- */
function FinancialsTab({ financials, setFinancials }) {
  const totalAgreed = financials.suppliers.reduce((acc, s) => acc + s.agreedValue, 0);
  const totalPaid = financials.suppliers.flatMap(s => s.installments).filter(i => i.paid).reduce((acc, i) => acc + i.value, 0);

  const toggleInstallmentPaid = (supplierId, installmentNum) => {
    const updatedSuppliers = financials.suppliers.map(s => {
      if (s.id === supplierId) {
        return {
          ...s,
          installments: s.installments.map(i => {
            if (i.number === installmentNum) {
              return { ...i, paid: !i.paid };
            }
            return i;
          })
        };
      }
      return s;
    });

    setFinancials({ ...financials, suppliers: updatedSuppliers });
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-serif font-bold text-slate-800">Controle Financeiro de Fornecedores</h2>
          <p className="text-xs text-slate-500">Acompanhe seu orçamento e vencimentos de parcelas.</p>
        </div>

        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-right">
          <span className="text-[10px] text-slate-400 uppercase">Teto de Gastos Desejado</span>
          <p className="font-serif font-bold text-slate-800 text-base">
            R$ {financials.targetBudget.toLocaleString('pt-BR')}
          </p>
        </div>
      </div>

      {/* Cards de Métricas Financeiras */}
      <div className="grid grid-cols-3 gap-4 text-center">
        <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
          <span className="text-[10px] text-blue-700 uppercase font-semibold">Total Fechado</span>
          <p className="text-lg font-serif font-bold text-blue-900">R$ {totalAgreed.toLocaleString('pt-BR')}</p>
        </div>
        <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
          <span className="text-[10px] text-emerald-700 uppercase font-semibold">Total Pago</span>
          <p className="text-lg font-serif font-bold text-emerald-900">R$ {totalPaid.toLocaleString('pt-BR')}</p>
        </div>
        <div className="bg-amber-50 p-3 rounded-xl border border-amber-100">
          <span className="text-[10px] text-amber-700 uppercase font-semibold">Falta Pagar</span>
          <p className="text-lg font-serif font-bold text-amber-900">R$ {(totalAgreed - totalPaid).toLocaleString('pt-BR')}</p>
        </div>
      </div>

      {/* Lista de Fornecedores */}
      <div className="space-y-4">
        {financials.suppliers.map(s => {
          const supplierPaid = s.installments.filter(i => i.paid).reduce((acc, i) => acc + i.value, 0);

          return (
            <div key={s.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">{s.name}</h4>
                  <span className="text-[10px] text-slate-500 bg-slate-200 px-2 py-0.5 rounded">{s.category}</span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-slate-800">Fechado: R$ {s.agreedValue.toLocaleString('pt-BR')}</span>
                  <p className="text-[10px] text-emerald-700">Pago: R$ {supplierPaid.toLocaleString('pt-BR')}</p>
                </div>
              </div>

              {/* Parcelas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {s.installments.map(inst => (
                  <div key={inst.number} className="flex justify-between items-center text-xs bg-white p-2.5 rounded border border-slate-200">
                    <div>
                      <span className="font-semibold text-slate-700">Parc. {inst.number} - R$ {inst.value.toLocaleString('pt-BR')}</span>
                      <p className="text-[10px] text-slate-400">Venc: {inst.dueDate}</p>
                    </div>
                    <button
                      onClick={() => toggleInstallmentPaid(s.id, inst.number)}
                      className={`px-2.5 py-1 rounded text-[10px] font-bold transition ${
                        inst.paid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                      }`}
                    >
                      {inst.paid ? 'PAGA ✓' : 'MARCAR PAGA'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* --- SUB-ABA: ESTILIZAÇÃO DO SITE --- */
function StylingTab({ coupleData, setCoupleData }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm max-w-2xl mx-auto space-y-6">
      <h2 className="text-xl font-serif font-bold text-slate-800">Estilização e Tema do Site</h2>

      <div className="space-y-4">
        <label className="block text-xs font-semibold text-slate-700">Escolha o Tema Visual:</label>

        <div className="grid grid-cols-3 gap-4">
          {Object.values(THEMES).map(t => (
            <button
              key={t.id}
              onClick={() => setCoupleData({ ...coupleData, selectedTheme: t.id })}
              className={`p-4 rounded-xl border text-center space-y-2 transition ${
                coupleData.selectedTheme === t.id 
                  ? 'border-[#4A5D4E] ring-2 ring-[#4A5D4E]/20 bg-emerald-50/20' 
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="w-8 h-8 rounded-full mx-auto shadow-sm" style={{ backgroundColor: t.id === 'jardim' ? '#4A5D4E' : t.id === 'boho' ? '#8C6D58' : '#2B2B2B' }} />
              <p className="text-xs font-bold text-slate-800">{t.name}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
