import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Heart, Calendar, Clock, MapPin, Gift, CheckCircle, Circle, 
  User, Users, DollarSign, Edit, Trash2, Plus, Lock, Send, 
  Sparkles, Camera, Phone, Mail, ChevronRight, AlertCircle, 
  Layout, Palette, CheckSquare, Settings, LogOut, ExternalLink,
  ChevronDown, MessageSquare, PieChart, ShieldAlert, Award, Copy,
  Check, RefreshCw, X, Printer
} from 'lucide-react';
import {
  callAdminFunction,
  callPublicFunction,
  getAdminSession,
  getCheckInUrlToken,
  invokeCheckIn,
  isSupabaseConfigured,
  loadFamilies,
  saveFamilies,
  signInAdmin,
  signOutAdmin
} from './supabase.js';

// --- ESTILOS VISUAIS E PALETA DE CORES DA FOTO DE REFERÊNCIA ---
// Bege Claro (#FCF9F2), Areia (#F4EFE6), Dourado/Bege Médio (#E8DED1)
// Verde Oliva Primário (#4A5D4E), Verde Oliva Escuro (#364539)

const isNonPayingChild = (member, buffetPayingAge) =>
  member.isChild && member.age < buffetPayingAge;

const giftQuotas = (gift) => ({
  gifted: gift.giftedQuotas || 0,
  reserved: gift.reservedQuotas || 0,
  total: gift.totalQuotas || 1
});

const DEFAULT_GUEST_PALETTE = {
  primary: '#4A5D4E',
  primaryHover: '#364539',
  background: '#FCF9F2',
  card: '#FFFFFF',
  text: '#1E293B',
  muted: '#64748B',
  border: '#E8DED1'
};

const DRESS_CODE_OPTIONS = {
  Formal: 'Traje elegante e sofisticado, com vestidos longos ou midi e ternos completos.',
  Social: 'Traje social, com vestidos, conjuntos, calças sociais, camisas e ternos.',
  'Esporte Fino': 'Visual elegante e confortável, com vestidos, macacões, camisas, calças de alfaiataria e blazers.',
  'Passeio Completo': 'Produção refinada para uma celebração especial, com tecidos nobres e acessórios elegantes.',
  Casual: 'Visual arrumado e confortável, mantendo o cuidado e a elegância para a ocasião.'
};

const getDressCodeText = (dressCode = {}) => {
  const styles = dressCode.styles?.length ? dressCode.styles : ['Esporte Fino'];
  const styleText = styles.map(style => DRESS_CODE_OPTIONS[style] || `${style}, escolhido especialmente para a celebração.`).join(' ');
  const avoidText = dressCode.avoidItems?.length
    ? `Para manter a harmonia do evento, pedimos que evitem: ${dressCode.avoidItems.join(', ')}.`
    : '';
  return dressCode.description?.trim() || `${styleText} ${avoidText}`.trim();
};

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
  const [adminSession, setAdminSession] = useState(null);
  const [adminAuthLoading, setAdminAuthLoading] = useState(isSupabaseConfigured);
  const [familiesReady, setFamiliesReady] = useState(false);
  const [familiesError, setFamiliesError] = useState('');

  // --- ESTADO GERAL DE CONFIGURAÇÃO DO CASAL ---
  const [coupleData, setCoupleData] = useState({
    groom: 'Rafael',
    bride: 'Amanda',
    monogram: 'A ♡ R',
    monogramImage: null, // URL da imagem PNG do monograma
    weddingDate: '2026-10-24T16:00',
    locationName: 'Espaço Jardim das Flores',
    address: 'Rua das Acácias, 123 - Gramado / RS',
    ceremonialist: 'Mariana Cerimonial',
    email: 'contato@amandaerafael.com',
    pixKey: 'amandaerafael@pix.com.br',
    story: 'Nos conhecemos na faculdade e desde o primeiro instante soubemos que caminharíamos juntos. O amor cresceu a cada conversa, viagem e sonho compartilhado. Agora, estamos prontos para dar o passo mais importante das nossas vidas!',
    coverImage: 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=1200',
    guestCarouselImages: [
      'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&q=80&w=1200',
      'https://images.unsplash.com/photo-1465495976277-4387d4b0e4a6?auto=format&fit=crop&q=80&w=1200'
    ],
    guestPalette: DEFAULT_GUEST_PALETTE,
    guestFont: 'Inter',
    dressCode: {
      styles: ['Esporte Fino'],
      description: '',
      forbiddenColors: [
        { name: 'Branco', value: '#FFFFFF' },
        { name: 'Off-White / Creme', value: '#FFFDD0' },
        { name: 'Marfim', value: '#F5F5DC' }
      ],
      avoidItems: ['Roupas esportivas', 'Bermudas', 'Regatas', 'Chinelos']
    },
    buffetPayingAge: 7, // Crianças a partir de 7 anos pagam
    guestLimit: 100,
    rsvpDeadline: '2026-09-24',
    selectedTheme: 'jardim'
  });

  const activeTheme = THEMES[coupleData.selectedTheme] || THEMES.jardim;
  const appPalette = { ...DEFAULT_GUEST_PALETTE, ...(coupleData.guestPalette || {}) };

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
      giftedQuotas: 0,
      reservedQuotas: 0,
      reservations: []
    },
    {
      id: 'g2',
      title: 'Kit Cama e Banho Premium 600 Fios',
      price: 180.00,
      image: 'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&q=80&w=400',
      totalQuotas: 5,
      giftedQuotas: 2,
      reservedQuotas: 0,
      reservations: [{ id: 'r1', name: 'Carlos Eduardo Silva', quotas: 2, status: 'gifted' }]
    },
    {
      id: 'g3',
      title: 'Viagem dos Sonhos - Cota Lua de Mel',
      price: 500.00,
      image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=400',
      totalQuotas: 10,
      giftedQuotas: 4,
      reservedQuotas: 0,
      reservations: [
        { id: 'r2', name: 'Roberto Oliveira', quotas: 2, status: 'gifted' },
        { id: 'r3', name: 'Ana Clara Silva', quotas: 2, status: 'gifted' }
      ]
    },
    {
      id: 'g4',
      title: 'Cafeteira de Aço Inox Espresso',
      price: 320.00,
      image: 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?auto=format&fit=crop&q=80&w=400',
      totalQuotas: 1,
      giftedQuotas: 1,
      reservedQuotas: 0,
      reservations: [{ id: 'r4', name: 'Fernanda Lima', quotas: 1, status: 'gifted' }]
    }
  ]);

  // --- ESTADO DE MENSAGENS MURAL DE RECADOS ---
  const [guestMessages, setGuestMessages] = useState([
    { id: 'msg1', name: 'Carlos Eduardo', text: 'Estamos muito ansiosos para celebrar essa união mágica com vocês! Que Deus abençoe!', date: '22/10/2026' },
    { id: 'msg2', name: 'Tia Beatriz', text: 'Desejo toda a felicidade do mundo ao casal lindo!', date: '20/10/2026' }
  ]);

  // --- ESTADO DE CHECKLIST DE TAREFAS ---
  const [tasks, setTasks] = useState([
    // 12 meses antes
    { id: 't1', title: 'Definir data e local da cerimônia', category: '12 meses antes', completed: true },
    { id: 't2', title: 'Definir o orçamento total do casamento', category: '12 meses antes', completed: true },
    { id: 't3', title: 'Montar lista inicial de convidados', category: '12 meses antes', completed: true },
    // 10 meses antes
    { id: 't4', title: 'Contratar cerimonialista', category: '10 meses antes', completed: true },
    { id: 't5', title: 'Contratar fotógrafo e videomaker', category: '10 meses antes', completed: true },
    { id: 't6', title: 'Reservar banda ou DJ para a festa', category: '10 meses antes', completed: false },
    // 8 meses antes
    { id: 't7', title: 'Pesquisar e fechar serviço de buffet', category: '8 meses antes', completed: true },
    { id: 't8', title: 'Escolher e encomendar convites', category: '8 meses antes', completed: false },
    { id: 't9', title: 'Iniciar pesquisa de vestido de noiva / traje do noivo', category: '8 meses antes', completed: false },
    // 6 meses antes
    { id: 't10', title: 'Escolher decoração e arranjos florais', category: '6 meses antes', completed: false },
    { id: 't11', title: 'Definir lista de presentes / chave PIX', category: '6 meses antes', completed: false },
    { id: 't12', title: 'Contratar serviço de doces e bolo', category: '6 meses antes', completed: false },
    // 3 meses antes
    { id: 't13', title: 'Enviar Save the Date aos convidados', category: '3 meses antes', completed: false },
    { id: 't14', title: 'Definir cardápio e menu de bebidas', category: '3 meses antes', completed: false },
    { id: 't15', title: 'Agendar prova de vestido / traje', category: '3 meses antes', completed: false },
    // 1 mês antes
    { id: 't16', title: 'Reunião final com todos os fornecedores', category: '1 mês antes', completed: false },
    { id: 't17', title: 'Enviar convites oficiais', category: '1 mês antes', completed: false },
    { id: 't18', title: 'Confirmar reservas e pagamentos pendentes', category: '1 mês antes', completed: false },
    // 15 dias antes
    { id: 't19', title: 'Degustação final do menu e doces', category: '15 dias antes', completed: false },
    { id: 't20', title: 'Confirmar lista final de convidados (RSVP)', category: '15 dias antes', completed: false },
    { id: 't21', title: 'Fazer última prova do vestido / traje', category: '15 dias antes', completed: false },
    // 1 semana antes
    { id: 't22', title: 'Confirmar horários com todos os fornecedores', category: '1 semana antes', completed: false },
    { id: 't23', title: 'Montar cronograma detalhado do dia', category: '1 semana antes', completed: false },
    { id: 't24', title: 'Preparar kit de emergência para o dia', category: '1 semana antes', completed: false },
    // 3 dias antes
    { id: 't25', title: 'Separar documentos para o cartório', category: '3 dias antes', completed: false },
    { id: 't26', title: 'Ensaio da cerimônia com padrinhos', category: '3 dias antes', completed: false },
    { id: 't27', title: 'Confirmar transporte dos noivos e convidados', category: '3 dias antes', completed: false },
    // 1 dia antes
    { id: 't28', title: 'Entregar itens de decoração no local', category: '1 dia antes', completed: false },
    { id: 't29', title: 'Confirmar horário de cabelo e maquiagem', category: '1 dia antes', completed: false },
    { id: 't30', title: 'Descansar e relaxar para o grande dia!', category: '1 dia antes', completed: false },
    // No dia
    { id: 't31', title: 'Cabelo, maquiagem e preparação dos noivos', category: 'No dia', completed: false },
    { id: 't32', title: 'Fotos do making of', category: 'No dia', completed: false },
    { id: 't33', title: 'Verificar se todos os fornecedores chegaram', category: 'No dia', completed: false },
    { id: 't34', title: 'Aproveitar cada momento! ♡', category: 'No dia', completed: false },
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

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    getAdminSession()
      .then(setAdminSession)
      .finally(() => setAdminAuthLoading(false));
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !adminSession?.access_token) {
      setFamiliesReady(false);
      return;
    }

    let active = true;
    setFamiliesReady(false);
    setFamiliesError('');
    loadFamilies(adminSession.access_token)
      .then(remoteFamilies => {
        if (!active) return;
        setFamilies(remoteFamilies);
        setFamiliesReady(true);
      })
      .catch(error => {
        if (!active) return;
        setFamiliesError(error.message);
      });

    return () => { active = false; };
  }, [adminSession?.access_token]);

  useEffect(() => {
    if (!isSupabaseConfigured || !adminSession?.access_token || !familiesReady) return;
    saveFamilies(families, adminSession.access_token)
      .then(() => setFamiliesError(''))
      .catch(error => setFamiliesError(`Não foi possível salvar as alterações: ${error.message}`));
  }, [families, familiesReady, adminSession?.access_token]);

  const handleAdminLogin = async (email, password) => {
    const session = await signInAdmin(email, password);
    setAdminSession(session);
    setFamiliesReady(false);
    setFamiliesError('');
  };

  const handleAdminLogout = () => {
    signOutAdmin();
    setAdminSession(null);
    setFamilies([]);
    setFamiliesReady(false);
  };

  if (window.location.pathname === '/check-in') {
    return <CheckInPage />;
  }

  return (
    <div
      className={`wedding-app min-h-screen ${activeTheme.bgPrimary} text-slate-800 transition-colors duration-300 font-sans`}
      style={{ '--app-background': appPalette.background, '--app-card': appPalette.card, '--app-primary': appPalette.primary, '--app-primary-hover': appPalette.primaryHover, '--app-text': appPalette.text, '--app-muted': appPalette.muted, '--app-border': appPalette.border }}
    >
      <style>{`
        .wedding-app { background-color: var(--app-background); color: var(--app-text); }
        .wedding-app .bg-white { background-color: var(--app-card) !important; }
        .wedding-app .text-slate-800, .wedding-app .text-slate-700 { color: var(--app-text) !important; }
        .wedding-app .text-slate-600, .wedding-app .text-slate-500, .wedding-app .text-slate-400 { color: var(--app-muted) !important; }
        .wedding-app .border-slate-200, .wedding-app .border-slate-300 { border-color: var(--app-border) !important; }
        .wedding-app .bg-\\[\\#4A5D4E\\], .wedding-app .bg-\\[\\#8C6D58\\], .wedding-app .bg-\\[\\#2B2B2B\\] { background-color: var(--app-primary) !important; }
        .wedding-app .hover\\:bg-\\[\\#364539\\]:hover, .wedding-app .hover\\:bg-\\[\\#6E5443\\]:hover, .wedding-app .hover\\:bg-\\[\\#111111\\]:hover { background-color: var(--app-primary-hover) !important; }
      `}</style>
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
      ) : isSupabaseConfigured && adminAuthLoading ? (
        <div className="min-h-[70vh] flex items-center justify-center text-sm text-slate-600">Verificando acesso ao painel...</div>
      ) : isSupabaseConfigured && !adminSession ? (
        <AdminLoginView onLogin={handleAdminLogin} />
      ) : isSupabaseConfigured && !familiesReady ? (
        <div className="min-h-[70vh] flex items-center justify-center text-sm text-slate-600">
          {familiesError || 'Carregando convidados...'}
        </div>
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
          onLogout={isSupabaseConfigured ? handleAdminLogout : undefined}
          adminEmail={adminSession?.user?.email}
          familiesError={familiesError}
          adminAccessToken={adminSession?.access_token}
        />
      )}
    </div>
  );
}

function CheckInPage() {
  const videoRef = useRef(null);
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [scanCycle, setScanCycle] = useState(0);
  const handledUrlToken = useRef(false);
  const urlToken = getCheckInUrlToken();

  useEffect(() => {
    getAdminSession()
      .then(setSession)
      .finally(() => setAuthLoading(false));
  }, []);

  const checkToken = async (value, accessToken) => {
    const raw = value.trim();
    if (!raw) return;
    let token = raw;
    try {
      token = new URL(raw, window.location.origin).searchParams.get('token') || raw;
    } catch {
      token = raw;
    }

    setIsChecking(true);
    setError('');
    try {
      setResult(await invokeCheckIn(token, accessToken));
    } catch (checkError) {
      if (checkError.code === 'not_confirmed') {
        setResult({ status: 'not_confirmed', message: 'Convidado não confirmado' });
      } else {
        setError(checkError.code === 'forbidden'
          ? 'Sua conta não tem autorização para registrar entradas.'
          : 'Não foi possível validar o QR code. Verifique a conexão e tente novamente.');
      }
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    if (!session?.access_token || result) return undefined;
    let active = true;
    let stream;
    let animationFrame;

    if (urlToken && !handledUrlToken.current) {
      handledUrlToken.current = true;
      checkToken(urlToken, session.access_token);
      return undefined;
    }

    if (!navigator.mediaDevices?.getUserMedia || !('BarcodeDetector' in window)) {
      setError('Este navegador não oferece leitura de QR pela câmera. Use Chrome em um aparelho compatível ou informe o código manualmente.');
      return undefined;
    }

    const startScanner = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (!active || !videoRef.current) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        const scanFrame = async () => {
          if (!active || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length && codes[0].rawValue) {
              active = false;
              stream?.getTracks().forEach(track => track.stop());
              await checkToken(codes[0].rawValue, session.access_token);
              return;
            }
          } catch (scanError) {
            console.error('QR camera scan failed', scanError);
            setError('A câmera não conseguiu ler o QR code. Tente novamente ou informe o código manualmente.');
            return;
          }
          animationFrame = requestAnimationFrame(scanFrame);
        };
        scanFrame();
      } catch (cameraError) {
        console.error('Unable to start QR camera', cameraError);
        setError('Não foi possível abrir a câmera. Permita o acesso à câmera ou informe o código manualmente.');
      }
    };

    startScanner();
    return () => {
      active = false;
      cancelAnimationFrame(animationFrame);
      stream?.getTracks().forEach(track => track.stop());
    };
  }, [session?.access_token, result, scanCycle]);

  if (!isSupabaseConfigured) {
    return <CheckInMessage message="O check-in ainda não está configurado. Configure o Supabase antes de usar este leitor." />;
  }
  if (authLoading) return <CheckInMessage message="Verificando acesso ao leitor..." />;
  if (!session) {
    return <AdminLoginView onLogin={async (email, password) => setSession(await signInAdmin(email, password))} />;
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 flex items-center justify-center">
      <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-7 space-y-4">
        <div className="text-center">
          <CheckCircle className="mx-auto mb-2 text-[#4A5D4E]" size={30} />
          <h1 className="text-2xl font-serif font-bold text-slate-800">Check-in dos convidados</h1>
          <p className="text-sm text-slate-500 mt-1">Leia o QR code individual para registrar a entrada.</p>
        </div>
        {!result && (
          <>
            <video ref={videoRef} className="w-full aspect-video rounded-xl bg-slate-900 object-cover" muted playsInline />
            <form
              onSubmit={(event) => {
                event.preventDefault();
                checkToken(manualCode, session.access_token);
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={manualCode}
                onChange={(event) => setManualCode(event.target.value)}
                placeholder="Ou cole o link/código do QR"
                aria-label="Código QR manual"
                className="min-w-0 flex-1 px-3 py-2 border rounded-lg text-sm"
              />
              <button
                type="submit"
                disabled={!manualCode.trim() || isChecking}
                className="px-4 py-2 rounded-lg bg-[#4A5D4E] text-white text-sm font-semibold disabled:opacity-50"
              >
                {isChecking ? 'Verificando...' : 'Validar'}
              </button>
            </form>
          </>
        )}
        {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
        {result && (
          <div className={`rounded-xl border p-5 text-center ${
            result.status === 'checked_in' ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : result.status === 'already_checked_in' ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}>
            <h2 className="text-lg font-bold">
              {result.status === 'checked_in' ? 'Entrada confirmada'
                : result.status === 'already_checked_in' ? 'Entrada já registrada'
                  : 'Convidado não confirmado'}
            </h2>
            {result.name && <p className="text-2xl font-serif mt-2">{result.name}</p>}
            {result.checkedInAt && (
              <p className="text-xs mt-2">{new Date(result.checkedInAt).toLocaleString('pt-BR')}</p>
            )}
          </div>
        )}
        {(result || error) && (
          <button
            type="button"
            onClick={() => {
              setResult(null);
              setError('');
              setManualCode('');
              setScanCycle(cycle => cycle + 1);
            }}
            className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold"
          >
            Ler próximo QR code
          </button>
        )}
      </div>
    </div>
  );
}

function CheckInMessage({ message }) {
  return (
    <div className="min-h-screen bg-slate-100 p-4 flex items-center justify-center">
      <p className="max-w-md bg-white border border-slate-200 rounded-xl p-5 text-center text-sm text-slate-700">{message}</p>
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
  const [carouselIndex, setCarouselIndex] = useState(0);
  const palette = { ...DEFAULT_GUEST_PALETTE, ...(coupleData.guestPalette || {}) };
  const carouselImages = coupleData.guestCarouselImages?.length
    ? coupleData.guestCarouselImages
    : [coupleData.coverImage];

  useEffect(() => {
    if (carouselImages.length < 2) return undefined;
    const timer = setInterval(() => {
      setCarouselIndex((current) => (current + 1) % carouselImages.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [carouselImages.length]);

  const guestThemeStyle = {
    '--guest-primary': palette.primary,
    '--guest-primary-hover': palette.primaryHover,
    '--guest-background': palette.background,
    '--guest-card': palette.card,
    '--guest-text': palette.text,
    '--guest-muted': palette.muted,
    '--guest-border': palette.border,
    '--guest-font': coupleData.guestFont || 'Inter'
  };

  // Rola suavemente até as seções
  const scrollToSection = (id) => {
    setActiveTab(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="guest-site-theme pb-20" style={guestThemeStyle}>
      <style>{`
        .guest-site-theme { font-family: var(--guest-font), sans-serif; background: var(--guest-background); }
        .guest-site-theme .bg-white, .guest-site-theme .bg-\\[\\#FFFDF9\\] { background-color: var(--guest-card) !important; }
        .guest-site-theme .text-slate-800, .guest-site-theme .text-slate-700 { color: var(--guest-text) !important; }
        .guest-site-theme .text-slate-600, .guest-site-theme .text-slate-500, .guest-site-theme .text-slate-400 { color: var(--guest-muted) !important; }
        .guest-site-theme .border-slate-200, .guest-site-theme .border-slate-300 { border-color: var(--guest-border) !important; }
        .guest-site-theme .border-\\[\\#E8DED1\\], .guest-site-theme .border-\\[\\#E0D3C3\\], .guest-site-theme .border-\\[\\#E5E5E5\\] { border-color: var(--guest-border) !important; }
        .guest-site-theme .font-serif, .guest-site-theme .font-sans { font-family: var(--guest-font), sans-serif !important; }
        .guest-site-theme .bg-\\[\\#4A5D4E\\], .guest-site-theme .bg-\\[\\#8C6D58\\], .guest-site-theme .bg-\\[\\#2B2B2B\\] { background-color: var(--guest-primary) !important; }
        .guest-site-theme .text-\\[\\#4A5D4E\\], .guest-site-theme .text-\\[\\#8C6D58\\], .guest-site-theme .text-\\[\\#2B2B2B\\] { color: var(--guest-primary) !important; }
        .guest-site-theme .hover\\:bg-\\[\\#364539\\]:hover, .guest-site-theme .hover\\:bg-\\[\\#6E5443\\]:hover, .guest-site-theme .hover\\:bg-\\[\\#111111\\]:hover { background-color: var(--guest-primary-hover) !important; }
      `}</style>
      {/* NAVEGAÇÃO INTERNA DO SITE DOS CONVIDADOS */}
      <nav className={`sticky top-[45px] z-30 ${activeTheme.bgCard} ${activeTheme.border} border-b shadow-sm py-3 px-4 backdrop-blur-md bg-opacity-90`}>
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className={`${activeTheme.fontHeader} text-xl font-bold ${activeTheme.accentText}`}>
            {coupleData.monogramImage ? (
              <img src={coupleData.monogramImage} alt="Monograma" className="h-10 object-contain" />
            ) : (
              coupleData.monogram
            )}
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
          <div className="w-full md:w-1/2 overflow-hidden rounded-xl shadow-md border border-amber-100/50 relative">
            <img
              src={carouselImages[carouselIndex]}
              alt={`Foto dos noivos ${carouselIndex + 1}`}
              className="w-full h-[320px] md:h-[400px] object-cover transition duration-500"
            />
            {carouselImages.length > 1 && (
              <>
                <button type="button" onClick={() => setCarouselIndex((carouselIndex - 1 + carouselImages.length) % carouselImages.length)} className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full w-8 h-8 text-lg">‹</button>
                <button type="button" onClick={() => setCarouselIndex((carouselIndex + 1) % carouselImages.length)} className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full w-8 h-8 text-lg">›</button>
                <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
                  {carouselImages.map((_, index) => (
                    <button key={index} type="button" onClick={() => setCarouselIndex(index)} className={`w-2 h-2 rounded-full ${index === carouselIndex ? 'bg-white' : 'bg-white/50'}`} aria-label={`Ir para foto ${index + 1}`} />
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="w-full md:w-1/2 text-center md:text-left space-y-4">
            <div className={`${activeTheme.fontHeader} text-4xl md:text-5xl font-serif tracking-tight ${activeTheme.accentText}`}>
              {coupleData.monogramImage ? (
                <img src={coupleData.monogramImage} alt="Monograma" className="h-20 md:h-28 object-contain" />
              ) : (
                coupleData.monogram
              )}
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
            <p className="text-slate-600 text-sm mt-1">{getDressCodeText(coupleData.dressCode)}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Cores Proibidas */}
            <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-200/60">
              <h4 className="font-semibold text-xs uppercase tracking-wider text-amber-900 mb-3 flex items-center gap-1.5">
                <ShieldAlert size={16} className="text-amber-700" /> Cores Reservadas / Proibidas
              </h4>
              <div className="hidden">
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
              <div className="flex flex-wrap items-center gap-3 mt-3">
                {(coupleData.dressCode?.forbiddenColors || []).map(color => (
                  <div key={`${color.name}-${color.value}`} className="flex items-center gap-1.5">
                    <span className="w-6 h-6 rounded-full border border-slate-300 shadow-sm" style={{ backgroundColor: color.value }} title={color.name}></span>
                    <span className="text-xs text-slate-700">{color.name}</span>
                  </div>
                ))}
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
              <ul className="hidden">
                <li>Roupas esportivas, bermudas ou regatas</li>
                <li>Tênis de corrida e chinelos</li>
                <li>Jeans muito rasgados ou casuais</li>
              </ul>
              <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside">
                {(coupleData.dressCode?.avoidItems || []).map(item => <li key={item}>{item}</li>)}
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
  const [pendingFamily, setPendingFamily] = useState(null);
  const [inviteToken, setInviteToken] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationError, setVerificationError] = useState('');
  const [lookupError, setLookupError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [deliveryWarning, setDeliveryWarning] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [foundFamily, setFoundFamily] = useState(null);
  const [responsibleName, setResponsibleName] = useState('');
  const [memberStatuses, setMemberStatuses] = useState({});
  const [rsvpFinished, setRsvpFinished] = useState(false);
  const [hasConfirmedAny, setHasConfirmedAny] = useState(false);

  // Busca o grupo familiar pelo nome digitado
  const handleSearch = (e) => {
    e.preventDefault();
    if (!searchName.trim()) return;
    setLookupError('');

    if (isSupabaseConfigured) {
      setPendingFamily({ id: '', name: searchName.trim(), phone: '', members: [] });
      setVerificationCode('');
      setVerificationError('');
      setResponsibleName(searchName.trim());
      setFoundFamily(null);
      return;
    }

    const term = searchName.toLowerCase().trim();
    const family = families.find(f => f.members.some(m => m.name.toLowerCase().includes(term)));

    if (family) {
      const alreadyResponded = family.members.length > 0
        && family.members.every(member => member.confirmed === true || member.confirmed === false);
      if (alreadyResponded) {
        setLookupError('already-sent');
        return;
      }

      setPendingFamily(family);
      setVerificationCode('');
      setVerificationError('');
      setResponsibleName(searchName);
      setFoundFamily(null);
    } else {
      alert("Nome não encontrado na lista de convidados. Por favor, digite seu nome completo exatamente como enviado pelos noivos.");
    }
  };

  const handleVerifyPhone = async (e) => {
    e.preventDefault();
    if (!pendingFamily) return;

    if (isSupabaseConfigured) {
      try {
        const result = await callPublicFunction('verify-invite', {
          name: searchName.trim(),
          phoneLastFour: verificationCode
        });
        setInviteToken(result.inviteToken);
        setMemberStatuses(Object.fromEntries(
          result.family.members.map(member => [member.id, member.confirmed ?? true])
        ));
        setFoundFamily(result.family);
        setPendingFamily(null);
        setVerificationCode('');
        setVerificationError('');
        setRsvpFinished(false);
      } catch (error) {
        if (error.code === 'already_sent') {
          setPendingFamily(null);
          setLookupError('already-sent');
        } else {
            const message = error.code === 'invite_not_found'
              ? 'Não foi possível localizar o convite com esse nome e telefone. Confira os dados ou fale com os noivos.'
              : error.code === 'too_many_attempts'
                ? 'Muitas tentativas de verificação. Aguarde 15 minutos antes de tentar novamente.'
                : 'Não foi possível verificar os dados agora. Tente novamente.';
            setVerificationError(message);
        }
      }
      return;
    }

    const phoneDigits = String(pendingFamily.phone || '').replace(/\D/g, '');
    if (phoneDigits.length < 4) {
      setVerificationError('Este convite não tem um telefone válido cadastrado. Entre em contato com os noivos.');
      return;
    }

    if (verificationCode !== phoneDigits.slice(-4)) {
      setVerificationError('Código incorreto. Confira os 4 últimos dígitos do telefone informado no convite.');
      return;
    }

    const initialMap = {};
    pendingFamily.members.forEach(member => {
      initialMap[member.id] = member.confirmed !== null ? member.confirmed : true;
    });
    setMemberStatuses(initialMap);
    setFoundFamily(pendingFamily);
    setPendingFamily(null);
    setVerificationCode('');
    setVerificationError('');
    setRsvpFinished(false);
  };

  const resetRsvpLookup = () => {
    setSearchName('');
    setFoundFamily(null);
    setPendingFamily(null);
    setVerificationCode('');
    setVerificationError('');
    setLookupError('');
    setSubmitError('');
    setDeliveryWarning('');
    setInviteToken('');
    setRsvpFinished(false);
    setHasConfirmedAny(false);
    setResponsibleName('');
    setMemberStatuses({});
  };

  const handleToggleMember = (memberId, confirmed) => {
    setMemberStatuses(prev => ({
      ...prev,
      [memberId]: confirmed
    }));
  };

  const handleSubmitRsvp = async () => {
    if (!foundFamily) return;

    setSubmitError('');
    setDeliveryWarning('');
    setIsSubmitting(true);
    try {
      if (isSupabaseConfigured) {
        const result = await callPublicFunction('submit-rsvp', {
          familyId: foundFamily.id,
          inviteToken,
          responses: memberStatuses
        });
        setHasConfirmedAny(result.confirmedCount > 0);
        const failedDeliveries = (result.delivery || []).filter(delivery => !delivery.sent).length;
        if (failedDeliveries) {
          setDeliveryWarning(`A resposta foi registrada, mas ${failedDeliveries} arquivo(s) de QR code não puderam ser enviados. Entre em contato com os noivos.`);
        }
        setFamilies(current => {
          const updatedFamily = {
            ...foundFamily,
            rsvpSubmittedAt: new Date().toISOString(),
            members: foundFamily.members.map(member => ({
              ...member,
              confirmed: Boolean(memberStatuses[member.id])
            }))
          };
          return [...current.filter(family => family.id !== updatedFamily.id), updatedFamily];
        });
      } else {
        const anyConfirmed = Object.values(memberStatuses).some(status => status === true);
        setHasConfirmedAny(anyConfirmed);

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
      }
      setRsvpFinished(true);
    } catch (error) {
      if (error.code === 'already_sent') {
        setFoundFamily(null);
        setLookupError('already-sent');
        setPendingFamily(null);
      } else {
        setSubmitError('Não foi possível registrar a resposta. Confira sua conexão e tente novamente.');
      }
    } finally {
      setIsSubmitting(false);
    }
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

      {!foundFamily && !pendingFamily ? (
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
            {lookupError && (
              lookupError === 'already-sent' ? (
                <div role="alert" className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950">
                  <p className="font-bold">Confirmação já enviada!</p>
                  <p className="mt-2">A resposta de confirmação para este convite já foi registrada. 💌</p>
                  <p className="mt-2">Caso precise realizar alguma alteração, entre em contato com os noivos ou com a organização do evento.</p>
                  <p className="mt-2">Agradecemos pelo carinho e pela atenção. Será uma alegria celebrar esse momento com vocês!</p>
                  <button
                    type="button"
                    onClick={resetRsvpLookup}
                    className="mt-4 rounded-lg border border-amber-300 bg-white px-4 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                  >
                    Buscar novo convite
                  </button>
                </div>
              ) : (
                <p role="alert" className="text-rose-700 text-xs mt-2">{lookupError}</p>
              )
            )}
          </div>
          <button 
            type="submit"
            className={`w-full ${activeTheme.accent} ${activeTheme.accentHover} text-white py-2.5 rounded-lg text-sm font-medium shadow transition`}
          >
            Buscar Convite
          </button>
        </form>
      ) : pendingFamily && !foundFamily ? (
        <form onSubmit={handleVerifyPhone} className="max-w-md mx-auto space-y-4">
          <div className="text-center">
            <p className="text-sm text-slate-700">Informe os 4 últimos dígitos do telefone da pessoa que recebeu o convite.</p>
          </div>
          <div>
            <label htmlFor="rsvp-verification-code" className="block text-xs font-semibold uppercase text-slate-600 mb-1">
              4 últimos dígitos do telefone
            </label>
            <input
              id="rsvp-verification-code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              autoComplete="one-time-code"
              value={verificationCode}
              onChange={(e) => {
                setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 4));
                setVerificationError('');
              }}
              placeholder="Ex: 1234"
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#4A5D4E] text-sm tracking-[0.3em] text-center"
              required
            />
            {verificationError && (
              <p role="alert" className="text-rose-700 text-xs mt-2">{verificationError}</p>
            )}
          </div>
          <button
            type="submit"
            className={`w-full ${activeTheme.accent} ${activeTheme.accentHover} text-white py-2.5 rounded-lg text-sm font-medium shadow transition`}
          >
            Verificar identidade
          </button>
          <button
            type="button"
            onClick={resetRsvpLookup}
            className="w-full text-xs text-slate-500 hover:text-slate-800 underline"
          >
            Buscar novo convite
          </button>
        </form>
      ) : !rsvpFinished ? (
        <div className="max-w-xl mx-auto space-y-6">
          <div className="bg-amber-50/60 p-3 rounded-lg border border-amber-200/80 text-xs text-amber-900 flex justify-between items-center">
            <span>Grupo/Família: <strong>{foundFamily.name}</strong></span>
            <button 
              onClick={resetRsvpLookup} 
              type="button"
              className="text-slate-500 hover:text-slate-800 text-[11px] underline"
            >
              Buscar novo convite
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
                  <label className={`cursor-pointer select-none px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1 focus-within:ring-2 focus-within:ring-emerald-500 ${
                    memberStatuses[member.id] === true
                      ? 'bg-emerald-700 text-white shadow-sm'
                      : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-100'
                  }`}>
                    <input
                      type="radio"
                      name={`rsvp-${member.id}`}
                      value="yes"
                      checked={memberStatuses[member.id] === true}
                      onChange={() => handleToggleMember(member.id, true)}
                      className="sr-only"
                    />
                    <CheckCircle size={13} /> Vou
                  </label>
                  <label className={`cursor-pointer select-none px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1 focus-within:ring-2 focus-within:ring-rose-500 ${
                    memberStatuses[member.id] === false
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-100'
                  }`}>
                    <input
                      type="radio"
                      name={`rsvp-${member.id}`}
                      value="no"
                      checked={memberStatuses[member.id] === false}
                      onChange={() => handleToggleMember(member.id, false)}
                      className="sr-only"
                    />
                    <X size={13} /> Não vou
                  </label>
                </div>
              </div>
            ))}
          </div>

          {/* Responsável e aviso de contato */}
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

            <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs leading-relaxed text-blue-900">
              A confirmação será enviada ao contato cadastrado: <strong>{foundFamily.phone}</strong>.
              {' '}Caso não reconheça esse número, fale com os noivos antes de continuar.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSubmitRsvp}
            disabled={isSubmitting}
            className={`w-full ${activeTheme.accent} ${activeTheme.accentHover} text-white py-3 rounded-xl font-medium text-sm shadow-md transition`}
          >
            {isSubmitting ? 'Registrando resposta...' : 'Salvar Confirmação'}
          </button>
          {submitError && <p role="alert" className="text-center text-xs text-rose-700">{submitError}</p>}
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
              ? `Obrigado, ${responsibleName}! Registramos a confirmação da sua família.`
              : `Agradecemos por nos avisar, ${responsibleName}. Sentiremos sua falta nesse dia tão especial.`
            }
          </p>
          {hasConfirmedAny && !deliveryWarning && isSupabaseConfigured && (
            <p className="text-slate-600 text-xs">Os QR codes individuais foram enviados ao WhatsApp cadastrado no convite.</p>
          )}
          {deliveryWarning && (
            <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              {deliveryWarning}
            </p>
          )}

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
            type="button"
            onClick={resetRsvpLookup}
            className="w-full rounded-lg border border-slate-300 bg-white py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Buscar novo convite
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
  const [donorName, setDonorName] = useState('');
  const [donorWhatsapp, setDonorWhatsapp] = useState('');
  const [reservationId, setReservationId] = useState('');
  const [isReserving, setIsReserving] = useState(false);
  const [isSubmittingReservation, setIsSubmittingReservation] = useState(false);
  const [reservationError, setReservationError] = useState('');
  const [pixModalOpen, setPixModalOpen] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [reservedSuccess, setReservedSuccess] = useState(false);
  const [scheduledReminderDays, setScheduledReminderDays] = useState([]);

  const handleOpenGift = (gift) => {
    setSelectedGift(gift);
    setQuotasToBuy(1);
    setDonorName('');
    setDonorWhatsapp('');
    setReservationId(crypto.randomUUID());
    setIsReserving(false);
    setIsSubmittingReservation(false);
    setReservationError('');
    setPixModalOpen(true);
    setCopySuccess(false);
    setReservedSuccess(false);
    setScheduledReminderDays([]);
  };

  const calculateAmount = () => {
    if (!selectedGift) return 0;
    const unitPrice = selectedGift.price / (selectedGift.totalQuotas || 1);
    return unitPrice * quotasToBuy;
  };

  const handleConfirmPixPayment = () => {
    if (!selectedGift || !donorName.trim()) return;

    const updatedGifts = gifts.map(g => {
      if (g.id === selectedGift.id) {
        const reservations = g.reservations || [];
        return {
          ...g,
          giftedQuotas: Math.min(g.totalQuotas, (g.giftedQuotas || 0) + quotasToBuy),
          reservations: [...reservations, { id: Date.now().toString(), name: donorName.trim(), quotas: quotasToBuy, status: 'gifted' }]
        };
      }
      return g;
    });

    setGifts(updatedGifts);
    alert("Pagamento simulado registrado! Os noivos agradecem de coração!");
    setPixModalOpen(false);
  };

  const handleReserveGift = async () => {
    if (!selectedGift || !donorName.trim() || !donorWhatsapp.trim()) return;
    setReservationError('');
    const eventDate = coupleData.weddingDate.slice(0, 10);
    const todayInBrazil = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo'
    }).format(new Date());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate) || eventDate <= todayInBrazil) {
      setReservationError('A data do evento já passou. Entre em contato com os noivos para combinar a reserva.');
      return;
    }

    setIsSubmittingReservation(true);
    const activeReservationId = reservationId || crypto.randomUUID();
    if (!reservationId) setReservationId(activeReservationId);

    try {
      if (isSupabaseConfigured) {
        await callPublicFunction('create-gift-reservation', {
          id: activeReservationId,
          guestName: donorName.trim(),
          whatsapp: donorWhatsapp,
          giftTitle: selectedGift.title,
          quotas: quotasToBuy,
          eventDate
        });
      }

      const updatedGifts = gifts.map(g => {
        if (g.id !== selectedGift.id) return g;
        return {
          ...g,
          reservedQuotas: Math.min(g.totalQuotas - (g.giftedQuotas || 0), (g.reservedQuotas || 0) + quotasToBuy),
          reservations: [...(g.reservations || []), {
            id: activeReservationId,
            name: donorName.trim(),
            whatsapp: donorWhatsapp.trim(),
            quotas: quotasToBuy,
            status: 'reserved'
          }]
        };
      });
      setGifts(updatedGifts);
      const daysUntilEvent = (
        Date.parse(`${eventDate}T00:00:00Z`) - Date.parse(`${todayInBrazil}T00:00:00Z`)
      ) / 86_400_000;
      setScheduledReminderDays([30, 15].filter(days => daysUntilEvent >= days));
      setReservedSuccess(true);
    } catch (error) {
      setReservationError(error.code === 'reminders_not_configured'
        ? 'Os lembretes automáticos ainda não estão configurados. Tente novamente mais tarde ou fale com os noivos.'
        : error.code === 'event_date_passed'
          ? 'A data do evento já passou. Entre em contato com os noivos para combinar a reserva.'
          : error.code === 'reservation_conflict'
            ? 'Os dados desta reserva mudaram durante o envio. Feche e abra o presente novamente para tentar de novo.'
          : error.code === 'too_many_attempts'
            ? 'Muitas tentativas de reserva. Aguarde 15 minutos e tente novamente.'
            : 'Não foi possível registrar a reserva e programar os lembretes. Verifique a conexão e tente novamente.');
    } finally {
      setIsSubmittingReservation(false);
    }
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
          const giftedQuotas = gift.giftedQuotas || 0;
          const reservedQuotas = gift.reservedQuotas || 0;
          const takenQuotas = giftedQuotas + reservedQuotas;
          const isSoldOut = takenQuotas >= gift.totalQuotas;
          const remainingQuotas = gift.totalQuotas - takenQuotas;
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
                      Cotas ({takenQuotas}/{gift.totalQuotas})
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
              disabled={isSubmittingReservation}
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

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Seu nome</label>
                  <input
                    type="text"
                    value={donorName}
                    onChange={(e) => setDonorName(e.target.value)}
                    placeholder="Nome de quem está presenteando"
                    className="w-full text-xs p-2 rounded border border-slate-300"
                  />
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
                      {[...Array(selectedGift.totalQuotas - (selectedGift.giftedQuotas || 0) - (selectedGift.reservedQuotas || 0))].map((_, i) => (
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
                      {coupleData.pixKey || 'Chave PIX não cadastrada'}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(coupleData.pixKey || '');
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
                  {!isReserving ? (
                    <>
                      <button
                        onClick={handleConfirmPixPayment}
                        disabled={!donorName.trim()}
                        className="w-full bg-emerald-700 hover:bg-emerald-800 text-white py-2.5 rounded-lg text-xs font-semibold shadow transition"
                      >
                        Já paguei via PIX
                      </button>
                      <button
                        onClick={() => setIsReserving(true)}
                        disabled={!donorName.trim()}
                        className="w-full bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 py-2 rounded-lg text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Reservar para pagar depois
                      </button>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Seu WhatsApp</label>
                        <input
                          type="tel"
                          autoComplete="tel"
                          value={donorWhatsapp}
                          onChange={(e) => setDonorWhatsapp(e.target.value)}
                          placeholder="(00) 00000-0000"
                          className="w-full text-xs p-2 rounded border border-slate-300"
                          required
                        />
                      </div>
                      <button
                        onClick={handleReserveGift}
                        disabled={!donorWhatsapp.trim() || isSubmittingReservation}
                        className="w-full bg-emerald-700 hover:bg-emerald-800 text-white py-2.5 rounded-lg text-xs font-semibold shadow transition disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isSubmittingReservation ? 'Registrando reserva...' : 'Confirmar reserva'}
                      </button>
                      {reservationError && <p role="alert" className="text-center text-[11px] text-rose-700">{reservationError}</p>}
                      <button
                        onClick={() => {
                          setIsReserving(false);
                          setDonorWhatsapp('');
                          setReservationError('');
                        }}
                        disabled={isSubmittingReservation}
                        className="w-full text-xs text-slate-500 hover:text-slate-800 underline"
                      >
                        Cancelar reserva
                      </button>
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-8 space-y-3">
                <CheckCircle size={40} className="text-amber-600 mx-auto" />
                <h4 className="font-bold text-slate-800">Presente Reservado com Sucesso!</h4>
                <p className="text-xs text-slate-600">
                  {isSupabaseConfigured
                    ? scheduledReminderDays.length
                      ? `Reserva registrada! O sistema enviará automaticamente lembretes pelo WhatsApp informado ${scheduledReminderDays.join(' e ')} dias antes do evento.`
                      : 'Reserva registrada! Os prazos para os lembretes automáticos de 30 e 15 dias antes do evento já passaram.'
                    : 'Reserva registrada apenas nesta sessão. Os lembretes automáticos pelo WhatsApp ainda não estão configurados.'}
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
function AdminLoginView({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await onLogin(email, password);
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="text-center">
          <Lock className="mx-auto mb-2 text-[#4A5D4E]" size={28} />
          <h2 className="text-xl font-serif font-bold text-slate-800">Acesso dos noivos</h2>
          <p className="text-xs text-slate-500 mt-1">Entre para gerenciar convidados e confirmações.</p>
        </div>
        <label className="block text-xs font-semibold text-slate-700">
          E-mail
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 w-full px-3 py-2 border rounded-lg text-sm"
            required
          />
        </label>
        <label className="block text-xs font-semibold text-slate-700">
          Senha
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 w-full px-3 py-2 border rounded-lg text-sm"
            required
          />
        </label>
        {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-[#4A5D4E] hover:bg-[#364539] disabled:opacity-60 text-white py-2.5 rounded-lg text-sm font-semibold"
        >
          {isSubmitting ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}

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
  setShowConfetti,
  onLogout,
  adminEmail,
  familiesError,
  adminAccessToken
}) {
  const [activeAdminTab, setActiveAdminTab] = useState('inicio');

  return (
    <div className="flex flex-col md:flex-row min-h-[calc(100vh-45px)] bg-slate-100">
      {/* SIDEBAR DO PAINEL */}
      <aside className="w-full md:w-64 bg-slate-900 text-slate-300 p-4 border-r border-slate-800 flex flex-col justify-between">
        <div className="space-y-6">
          <div className="px-2 pt-2">
            <div className="font-serif text-2xl font-bold text-amber-400 tracking-wider">
              {coupleData.monogramImage ? (
                <img src={coupleData.monogramImage} alt="Monograma" className="h-10 object-contain" />
              ) : (
                coupleData.monogram
              )}
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
            <SidebarButton
              active={activeAdminTab === 'dresscode'}
              onClick={() => setActiveAdminTab('dresscode')}
              icon={<ShieldAlert size={16} />}
              label="Dress Code"
            />
          </nav>
        </div>

        <div className="pt-6 border-t border-slate-800 text-xs text-slate-500">
          {onLogout ? (
            <>
              Logado como: <br />
              <strong className="text-slate-300">{adminEmail}</strong>
              <button onClick={onLogout} className="block mt-3 text-slate-400 hover:text-white">Sair do painel</button>
            </>
          ) : (
            <>Logado como: <br /><strong className="text-slate-300">{coupleData.email}</strong></>
          )}
        </div>
      </aside>

      {/* ÁREA DE CONTEÚDO PRINCIPAL DO PAINEL */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        {familiesError && (
          <p role="alert" className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800">
            {familiesError}
          </p>
        )}
        {activeAdminTab === 'inicio' && (
          <AdminOverviewTab 
            coupleData={coupleData}
            families={families}
            gifts={gifts}
            financials={financials}
            tasks={tasks}
            setActiveAdminTab={setActiveAdminTab}
          />
        )}
        {activeAdminTab === 'dados' && (
          <CoupleDataTab coupleData={coupleData} setCoupleData={setCoupleData} />
        )}

        {activeAdminTab === 'tarefas' && (
          <TasksTab tasks={tasks} setTasks={setTasks} />
        )}
        {activeAdminTab === 'convidados' && (
          <GuestsTab families={families} setFamilies={setFamilies} coupleData={coupleData} setCoupleData={setCoupleData} adminAccessToken={adminAccessToken} />
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
        {activeAdminTab === 'dresscode' && (
          <DressCodeTab coupleData={coupleData} setCoupleData={setCoupleData} />
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
function AdminOverviewTab({ coupleData, families, gifts, financials, tasks, setActiveAdminTab }) {
  // Cálculos de resumo
  const allMembers = families.flatMap(f => f.members);
  const guests = allMembers.filter(m => !isNonPayingChild(m, coupleData.buffetPayingAge));
  const totalGuests = guests.length;
  const confirmedGuests = guests.filter(m => m.confirmed === true).length;
  const unconfirmedGuests = guests.filter(m => m.confirmed === null || m.confirmed === undefined).length;

  const totalGiftsValue = gifts.reduce((acc, g) => {
    const status = giftQuotas(g);
    return acc + (g.price * (status.gifted / status.total));
  }, 0);
  const reservedGiftsValue = gifts.reduce((acc, g) => {
    const status = giftQuotas(g);
    return acc + (g.price * (status.reserved / status.total));
  }, 0);

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
          subtitle={`R$ ${reservedGiftsValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} reservados`}
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
            <label className="block text-xs font-semibold text-slate-700 mb-1">Monograma (Imagem PNG)</label>
            {formData.monogramImage && (
              <div className="mb-2 p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center gap-3">
                <img src={formData.monogramImage} alt="Monograma atual" className="h-14 object-contain" />
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, monogramImage: null })}
                  className="text-xs text-rose-600 hover:text-rose-800 font-medium flex items-center gap-1"
                >
                  <Trash2 size={12} /> Remover
                </button>
              </div>
            )}
            <input 
              type="file" 
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    setFormData({ ...formData, monogramImage: ev.target.result });
                  };
                  reader.readAsDataURL(file);
                }
              }}
              className="w-full px-3 py-2 border rounded-lg text-sm file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[#4A5D4E] file:text-white hover:file:bg-[#364539] file:cursor-pointer"
            />
            <p className="text-[10px] text-slate-400 mt-1">Envie a imagem do monograma em PNG com fundo transparente.</p>
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
            <label className="block text-xs font-semibold text-slate-700 mb-1 mt-3">Chave PIX para presentes</label>
            <input
              type="text"
              name="pixKey"
              value={formData.pixKey || ''}
              onChange={handleChange}
              placeholder="CPF, e-mail, telefone ou chave aleatória"
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



/* --- SUB-ABA: CHECKLIST / TAREFAS --- */

// Ordem dos períodos para exibição
const PERIOD_ORDER = [
  '12 meses antes',
  '10 meses antes',
  '8 meses antes',
  '6 meses antes',
  '3 meses antes',
  '1 mês antes',
  '15 dias antes',
  '1 semana antes',
  '3 dias antes',
  '1 dia antes',
  'No dia',
];

// Cores e ícones por período
const PERIOD_STYLES = {
  '12 meses antes': { color: 'bg-violet-100 text-violet-800 border-violet-200', dot: 'bg-violet-500' },
  '10 meses antes': { color: 'bg-blue-100 text-blue-800 border-blue-200', dot: 'bg-blue-500' },
  '8 meses antes': { color: 'bg-sky-100 text-sky-800 border-sky-200', dot: 'bg-sky-500' },
  '6 meses antes': { color: 'bg-teal-100 text-teal-800 border-teal-200', dot: 'bg-teal-500' },
  '3 meses antes': { color: 'bg-emerald-100 text-emerald-800 border-emerald-200', dot: 'bg-emerald-500' },
  '1 mês antes': { color: 'bg-amber-100 text-amber-800 border-amber-200', dot: 'bg-amber-500' },
  '15 dias antes': { color: 'bg-orange-100 text-orange-800 border-orange-200', dot: 'bg-orange-500' },
  '1 semana antes': { color: 'bg-rose-100 text-rose-800 border-rose-200', dot: 'bg-rose-500' },
  '3 dias antes': { color: 'bg-pink-100 text-pink-800 border-pink-200', dot: 'bg-pink-500' },
  '1 dia antes': { color: 'bg-red-100 text-red-800 border-red-200', dot: 'bg-red-500' },
  'No dia': { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', dot: 'bg-yellow-500' },
};

// Checklist padrão recomendado
const DEFAULT_CHECKLIST = [
  { title: 'Definir data e local da cerimônia', category: '12 meses antes' },
  { title: 'Definir o orçamento total do casamento', category: '12 meses antes' },
  { title: 'Montar lista inicial de convidados', category: '12 meses antes' },
  { title: 'Contratar cerimonialista', category: '10 meses antes' },
  { title: 'Contratar fotógrafo e videomaker', category: '10 meses antes' },
  { title: 'Reservar banda ou DJ para a festa', category: '10 meses antes' },
  { title: 'Pesquisar e fechar serviço de buffet', category: '8 meses antes' },
  { title: 'Escolher e encomendar convites', category: '8 meses antes' },
  { title: 'Iniciar pesquisa de vestido de noiva / traje do noivo', category: '8 meses antes' },
  { title: 'Escolher decoração e arranjos florais', category: '6 meses antes' },
  { title: 'Definir lista de presentes / chave PIX', category: '6 meses antes' },
  { title: 'Contratar serviço de doces e bolo', category: '6 meses antes' },
  { title: 'Enviar Save the Date aos convidados', category: '3 meses antes' },
  { title: 'Definir cardápio e menu de bebidas', category: '3 meses antes' },
  { title: 'Agendar prova de vestido / traje', category: '3 meses antes' },
  { title: 'Reunião final com todos os fornecedores', category: '1 mês antes' },
  { title: 'Enviar convites oficiais', category: '1 mês antes' },
  { title: 'Confirmar reservas e pagamentos pendentes', category: '1 mês antes' },
  { title: 'Degustação final do menu e doces', category: '15 dias antes' },
  { title: 'Confirmar lista final de convidados (RSVP)', category: '15 dias antes' },
  { title: 'Fazer última prova do vestido / traje', category: '15 dias antes' },
  { title: 'Confirmar horários com todos os fornecedores', category: '1 semana antes' },
  { title: 'Montar cronograma detalhado do dia', category: '1 semana antes' },
  { title: 'Preparar kit de emergência para o dia', category: '1 semana antes' },
  { title: 'Separar documentos para o cartório', category: '3 dias antes' },
  { title: 'Ensaio da cerimônia com padrinhos', category: '3 dias antes' },
  { title: 'Confirmar transporte dos noivos e convidados', category: '3 dias antes' },
  { title: 'Entregar itens de decoração no local', category: '1 dia antes' },
  { title: 'Confirmar horário de cabelo e maquiagem', category: '1 dia antes' },
  { title: 'Descansar e relaxar para o grande dia!', category: '1 dia antes' },
  { title: 'Cabelo, maquiagem e preparação dos noivos', category: 'No dia' },
  { title: 'Fotos do making of', category: 'No dia' },
  { title: 'Verificar se todos os fornecedores chegaram', category: 'No dia' },
  { title: 'Aproveitar cada momento! ♡', category: 'No dia' },
];

function TasksTab({ tasks, setTasks }) {
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskCategory, setNewTaskCategory] = useState('6 meses antes');
  const [collapsedPeriods, setCollapsedPeriods] = useState({});
  const [showRecommendModal, setShowRecommendModal] = useState(false);

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

  const togglePeriod = (period) => {
    setCollapsedPeriods(prev => ({ ...prev, [period]: !prev[period] }));
  };

  const handleLoadRecommended = () => {
    const newTasks = DEFAULT_CHECKLIST.map((item, index) => ({
      id: `rec_${Date.now()}_${index}`,
      title: item.title,
      category: item.category,
      completed: false,
    }));
    setTasks(newTasks);
    setShowRecommendModal(false);
  };

  // Agrupar tarefas por período
  const tasksByPeriod = useMemo(() => {
    const grouped = {};
    PERIOD_ORDER.forEach(period => {
      const periodTasks = tasks.filter(t => t.category === period);
      if (periodTasks.length > 0) {
        grouped[period] = periodTasks;
      }
    });
    // Incluir tarefas de categorias personalizadas que não estão na ordem padrão
    tasks.forEach(t => {
      if (!PERIOD_ORDER.includes(t.category)) {
        if (!grouped[t.category]) grouped[t.category] = [];
        grouped[t.category].push(t);
      }
    });
    return grouped;
  }, [tasks]);

  // Cálculos de progresso
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.completed).length;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Cor da barra de progresso baseada no percentual
  const getProgressColor = () => {
    if (progressPercent >= 80) return 'bg-emerald-500';
    if (progressPercent >= 50) return 'bg-amber-500';
    if (progressPercent >= 25) return 'bg-orange-500';
    return 'bg-rose-500';
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* HEADER + PROGRESSO GERAL */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-xl font-serif font-bold text-slate-800">Checklist do Casamento</h2>
            <p className="text-xs text-slate-500 mt-0.5">Organize cada detalhe, período por período.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowRecommendModal(true)}
              className="bg-amber-50 text-amber-800 hover:bg-amber-100 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border border-amber-200 shadow-sm transition"
            >
              <RefreshCw size={13} /> Carregar Checklist Recomendado
            </button>
          </div>
        </div>

        {/* BARRA DE PROGRESSO GERAL */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Award size={14} className="text-amber-600" /> Progresso Geral
            </span>
            <span className="text-xs font-bold text-slate-800">
              {completedTasks} de {totalTasks} tarefas ({progressPercent}%)
            </span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-3.5 overflow-hidden shadow-inner">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${getProgressColor()} relative`}
              style={{ width: `${progressPercent}%` }}
            >
              {progressPercent > 8 && (
                <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white drop-shadow">
                  {progressPercent}%
                </span>
              )}
            </div>
          </div>
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>Início</span>
            <span>Grande Dia ♡</span>
          </div>
        </div>
      </div>

      {/* FORMULÁRIO PARA ADICIONAR TAREFA */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-3 flex items-center gap-1.5">
          <Plus size={14} /> Adicionar Nova Tarefa
        </h3>
        <form onSubmit={handleAddTask} className="flex flex-col sm:flex-row gap-2">
          <input 
            type="text" 
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="Descreva a tarefa..."
            className="flex-1 px-3 py-2.5 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#4A5D4E]"
          />
          <select
            value={newTaskCategory}
            onChange={(e) => setNewTaskCategory(e.target.value)}
            className="px-3 py-2.5 border border-slate-300 rounded-lg text-xs bg-white"
          >
            {PERIOD_ORDER.map(period => (
              <option key={period} value={period}>{period}</option>
            ))}
          </select>
          <button 
            type="submit"
            className="bg-[#4A5D4E] hover:bg-[#364539] text-white px-5 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-sm"
          >
            <Plus size={14} /> Adicionar
          </button>
        </form>
      </div>

      {/* BLOCOS DE TAREFAS POR PERÍODO */}
      <div className="space-y-4">
        {Object.entries(tasksByPeriod).map(([period, periodTasks]) => {
          const style = PERIOD_STYLES[period] || { color: 'bg-slate-100 text-slate-800 border-slate-200', dot: 'bg-slate-500' };
          const isCollapsed = collapsedPeriods[period];
          const completedInPeriod = periodTasks.filter(t => t.completed).length;
          const totalInPeriod = periodTasks.length;
          const periodPercent = totalInPeriod > 0 ? Math.round((completedInPeriod / totalInPeriod) * 100) : 0;
          const allDone = completedInPeriod === totalInPeriod;

          return (
            <div 
              key={period} 
              className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition ${
                allDone ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200'
              }`}
            >
              {/* Header do bloco de período */}
              <button
                onClick={() => togglePeriod(period)}
                className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-50/50 transition"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${style.dot} ${allDone ? 'ring-2 ring-emerald-300' : ''}`} />
                  <div className="text-left">
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      {period}
                      {allDone && <CheckCircle size={14} className="text-emerald-600" />}
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {completedInPeriod} de {totalInPeriod} tarefas concluídas
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {/* Mini barra de progresso por período */}
                  <div className="hidden sm:flex items-center gap-2">
                    <div className="w-24 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${allDone ? 'bg-emerald-500' : style.dot}`}
                        style={{ width: `${periodPercent}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-semibold text-slate-500 w-8 text-right">{periodPercent}%</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${style.color}`}>
                    {completedInPeriod}/{totalInPeriod}
                  </span>
                  <ChevronDown 
                    size={16} 
                    className={`text-slate-400 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-180'}`} 
                  />
                </div>
              </button>

              {/* Lista de tarefas do período */}
              {!isCollapsed && (
                <div className="px-5 pb-4 space-y-1.5 border-t border-slate-100">
                  {periodTasks.map(task => (
                    <div 
                      key={task.id} 
                      className={`flex items-center justify-between p-3 rounded-xl transition group ${
                        task.completed 
                          ? 'bg-emerald-50/60 border border-emerald-100' 
                          : 'bg-slate-50/80 border border-slate-100 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <button 
                          onClick={() => handleToggleTask(task.id)} 
                          className="flex-shrink-0 transition-transform hover:scale-110"
                        >
                          {task.completed 
                            ? <CheckCircle size={18} className="text-emerald-600" /> 
                            : <Circle size={18} className="text-slate-400 hover:text-[#4A5D4E]" />
                          }
                        </button>
                        <span className={`text-xs truncate ${
                          task.completed ? 'line-through text-slate-400' : 'text-slate-800 font-medium'
                        }`}>
                          {task.title}
                        </span>
                      </div>
                      <button 
                        onClick={() => handleDeleteTask(task.id)} 
                        className="text-slate-300 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition flex-shrink-0 ml-2"
                        title="Excluir tarefa"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Mensagem quando não há tarefas */}
      {totalTasks === 0 && (
        <div className="bg-white p-8 rounded-2xl border border-dashed border-slate-300 text-center space-y-3">
          <CheckSquare size={36} className="text-slate-300 mx-auto" />
          <h3 className="font-serif font-bold text-slate-600">Nenhuma tarefa cadastrada</h3>
          <p className="text-xs text-slate-400">
            Adicione tarefas manualmente ou carregue o checklist recomendado para começar.
          </p>
          <button
            onClick={() => setShowRecommendModal(true)}
            className="bg-[#4A5D4E] hover:bg-[#364539] text-white px-5 py-2 rounded-lg text-xs font-semibold shadow transition inline-flex items-center gap-1.5"
          >
            <Sparkles size={14} /> Carregar Checklist Recomendado
          </button>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO - CHECKLIST RECOMENDADO */}
      {showRecommendModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
                <Sparkles size={24} className="text-amber-700" />
              </div>
              <h3 className="font-serif text-lg font-bold text-slate-800">Carregar Checklist Recomendado?</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Isso vai substituir todas as tarefas atuais por um checklist completo com <strong>{DEFAULT_CHECKLIST.length} tarefas</strong> divididas em {PERIOD_ORDER.length} períodos, desde 12 meses antes até o dia do casamento.
              </p>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 max-h-40 overflow-y-auto">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Períodos incluídos:</p>
              <div className="flex flex-wrap gap-1.5">
                {PERIOD_ORDER.map(period => {
                  const style = PERIOD_STYLES[period];
                  return (
                    <span key={period} className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${style.color}`}>
                      {period}
                    </span>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowRecommendModal(false)}
                className="flex-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 py-2.5 rounded-xl text-xs font-semibold transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleLoadRecommended}
                className="flex-1 bg-[#4A5D4E] hover:bg-[#364539] text-white py-2.5 rounded-xl text-xs font-semibold shadow transition"
              >
                Confirmar e Carregar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* --- SUB-ABA: LISTA DE CONVIDADOS & FAMÍLIAS --- */
function GuestsTab({ families, setFamilies, coupleData, setCoupleData, adminAccessToken }) {
  const [newFamilyName, setNewFamilyName] = useState('');
  const [newFamilyPhone, setNewFamilyPhone] = useState('');
  const [qrSendState, setQrSendState] = useState({});
  const [editingMemberId, setEditingMemberId] = useState(null);
  const [editingMemberName, setEditingMemberName] = useState('');
  const [editingMemberIsChild, setEditingMemberIsChild] = useState(false);
  const [editingMemberAge, setEditingMemberAge] = useState('');
  const [editingMemberStatus, setEditingMemberStatus] = useState('');
  const [editingFamilyId, setEditingFamilyId] = useState(null);
  const [editingFamilyName, setEditingFamilyName] = useState('');
  const [editingFamilyPhone, setEditingFamilyPhone] = useState('');
  const [isEditingPayingAge, setIsEditingPayingAge] = useState(false);
  const [isEditingGuestLimit, setIsEditingGuestLimit] = useState(false);
  const [collapsedFamilyIds, setCollapsedFamilyIds] = useState([]);
  const allMembers = families.flatMap(family => family.members);
  const payingGuests = allMembers.filter(member => !isNonPayingChild(member, coupleData.buffetPayingAge));
  const confirmedGuests = payingGuests.filter(member => member.confirmed === true).length;
  const confirmedAdults = allMembers.filter(member => !member.isChild && member.confirmed === true).length;
  const confirmedChildren = allMembers.filter(member => member.isChild && member.confirmed === true).length;
  const pendingGuests = allMembers.filter(member => member.confirmed == null).length;
  const absentGuests = allMembers.filter(member => member.confirmed === false).length;
  const guestLimit = Number(coupleData.guestLimit ?? 100);
  const remainingSlots = guestLimit - payingGuests.length;

  const handleGeneratePdf = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.alert('Não foi possível abrir a janela do PDF. Permita pop-ups para este site e tente novamente.');
      return;
    }

    const escapeHtml = (value) => String(value).replace(/[&<>"']/g, character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[character]);
    const confirmedFamilies = families
      .map(family => ({
        ...family,
        confirmedMembers: family.members
          .filter(member => member.confirmed === true)
          .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
      }))
      .filter(family => family.confirmedMembers.length > 0);
    const confirmedCount = confirmedFamilies.reduce((count, family) => count + family.confirmedMembers.length, 0);
    const renderFamilies = () => confirmedFamilies.length
      ? confirmedFamilies.map(family => `
          <section>
            <h2>${escapeHtml(family.name)}</h2>
            <ol>${family.confirmedMembers.map(member => {
              const childLabel = member.isChild ? ` (Criança, ${member.age} anos)` : '';
              return `<li>${escapeHtml(member.name)}${escapeHtml(childLabel)}</li>`;
            }).join('')}</ol>
          </section>
        `).join('')
      : '<p>Nenhum convidado confirmado.</p>';

    printWindow.document.write(`<!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8">
          <title>Lista de convidados</title>
          <style>
            body { font-family: Arial, sans-serif; color: #26332a; margin: 32px; }
            h1 { margin-bottom: 8px; }
            h2 { margin: 28px 0 8px; border-bottom: 1px solid #d8ded9; padding-bottom: 6px; }
            p, li { font-size: 14px; line-height: 1.6; }
            ol { padding-left: 24px; }
            @media print { body { margin: 18mm; } }
          </style>
        </head>
        <body>
          <h1>Lista de convidados</h1>
          <p>${confirmedCount} convidados confirmados</p>
          ${renderFamilies()}
        </body>
      </html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const handleAddFamily = (e) => {
    e.preventDefault();
    if (!newFamilyName.trim()) return;

    const newFamily = {
      id: crypto.randomUUID(),
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
            { id: crypto.randomUUID(), name, isChild, age: Number(age) || 0, confirmed: null }
          ]
        };
      }
      return f;
    });

    setFamilies(updatedFamilies);
  };

  const handleStartEditingMember = (member) => {
    setEditingMemberId(member.id);
    setEditingMemberName(member.name);
    setEditingMemberIsChild(member.isChild);
    setEditingMemberAge(String(member.age ?? ''));
    setEditingMemberStatus(member.confirmed === true ? 'confirmed' : member.confirmed === false ? 'absent' : 'pending');
  };

  const handleSaveMember = (e, familyId, memberId) => {
    e.preventDefault();
    if (!editingMemberName.trim()) return;

    setFamilies(families.map(family => family.id === familyId
      ? {
          ...family,
          members: family.members.map(member => member.id === memberId
            ? {
                ...member,
                name: editingMemberName.trim(),
                isChild: editingMemberIsChild,
                age: editingMemberIsChild ? Number(editingMemberAge) || 0 : member.age,
                confirmed: editingMemberStatus === 'confirmed' ? true : editingMemberStatus === 'absent' ? false : null
              }
            : member)
        }
      : family));
    setEditingMemberId(null);
  };

  const handleDeleteMember = (familyId, member) => {
    if (!window.confirm(`Excluir o convidado "${member.name}"?`)) return;

    setFamilies(families.map(family => family.id === familyId
      ? { ...family, members: family.members.filter(item => item.id !== member.id) }
      : family));
    if (editingMemberId === member.id) setEditingMemberId(null);
  };

  const handleDeleteFamily = (family) => {
    if (!window.confirm(`Excluir "${family.name}" e todos os convidados deste grupo?`)) return;
    setFamilies(families.filter(item => item.id !== family.id));
    if (family.members.some(member => member.id === editingMemberId)) setEditingMemberId(null);
    if (editingFamilyId === family.id) setEditingFamilyId(null);
  };

  const handleResendGuestQrs = async (family) => {
    if (!adminAccessToken) return;
    setQrSendState(current => ({ ...current, [family.id]: 'Enviando QR codes...' }));
    try {
      const result = await callAdminFunction(
        'resend-guest-qrs',
        { familyId: family.id },
        adminAccessToken
      );
      const sentCount = (result.delivery || []).filter(item => item.sent).length;
      setQrSendState(current => ({
        ...current,
        [family.id]: result.confirmedCount === 0
          ? 'Não há convidados confirmados neste grupo.'
          : sentCount === result.confirmedCount
            ? `QR codes enviados: ${sentCount}/${result.confirmedCount}.`
            : `Falha no envio de ${result.confirmedCount - sentCount} QR code(s). Tente reenviar.`
      }));
    } catch (error) {
      setQrSendState(current => ({ ...current, [family.id]: `Falha ao enviar QR codes: ${error.message}` }));
    }
  };

  const handleStartEditingFamily = (family) => {
    setEditingFamilyId(family.id);
    setEditingFamilyName(family.name);
    setEditingFamilyPhone(family.phone || '');
    setCollapsedFamilyIds(ids => ids.filter(id => id !== family.id));
  };

  const handleSaveFamily = (e, familyId) => {
    e.preventDefault();
    if (!editingFamilyName.trim()) return;

    setFamilies(families.map(family => family.id === familyId
      ? { ...family, name: editingFamilyName.trim(), phone: editingFamilyPhone.trim() }
      : family));
    setEditingFamilyId(null);
  };

  const toggleFamilyExpanded = (familyId) => {
    setCollapsedFamilyIds(ids => ids.includes(familyId)
      ? ids.filter(id => id !== familyId)
      : [...ids, familyId]);
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-serif font-bold text-slate-800">Gerenciador de Convidados</h2>
          <p className="text-xs text-slate-500">Organize convidados por famílias e gerencie pagantes do buffet.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-200 text-xs flex items-center gap-2">
            {isEditingPayingAge ? (
              <>
                <label htmlFor="buffet-paying-age">Idade pagante buffet:</label>
                <input
                  id="buffet-paying-age"
                  type="number"
                  min="0"
                  value={coupleData.buffetPayingAge}
                  onChange={(e) => setCoupleData({ ...coupleData, buffetPayingAge: Number(e.target.value) })}
                  className="w-12 text-center border rounded p-0.5 text-xs bg-white"
                  autoFocus
                />
                <span>anos</span>
                <button
                  type="button"
                  onClick={() => setIsEditingPayingAge(false)}
                  className="p-1 text-emerald-700 hover:text-emerald-900"
                  aria-label="Concluir edição da idade pagante"
                  title="Concluir edição"
                >
                  <Check size={14} />
                </button>
              </>
            ) : (
              <>
                <span>Idade pagante buffet: <strong>{coupleData.buffetPayingAge}+ anos</strong></span>
                <button
                  type="button"
                  onClick={() => setIsEditingPayingAge(true)}
                  className="p-1 text-slate-500 hover:text-blue-700"
                  aria-label="Editar idade pagante do buffet"
                  title="Editar idade pagante"
                >
                  <Edit size={14} />
                </button>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={handleGeneratePdf}
            className="bg-[#4A5D4E] hover:bg-[#364539] text-white px-3 py-2.5 rounded-lg text-xs font-semibold flex items-center gap-2"
          >
            <Printer size={15} /> Gerar PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1">
        <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200">
          <div className="flex flex-col justify-center items-center gap-2 text-xs text-slate-500 border-b border-slate-100 pb-3 mb-4">
            <span>Convidados Pagantes / Limite:</span>
            <div className="flex items-center justify-center gap-2">
              <strong className="text-slate-700">{payingGuests.length}</strong>
              <span>/</span>
              {isEditingGuestLimit ? (
                <>
                  <input
                    id="guest-limit"
                    type="number"
                    min="1"
                    step="1"
                    aria-label="Limite de convidados pagantes"
                    value={coupleData.guestLimit ?? 100}
                    onChange={(e) => setCoupleData({
                      ...coupleData,
                      guestLimit: e.target.value === '' ? '' : Number(e.target.value)
                    })}
                    className="w-20 px-2 py-1 border border-slate-300 rounded-lg text-sm bg-white"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setIsEditingGuestLimit(false)}
                    className="p-1 text-emerald-700 hover:text-emerald-900"
                    aria-label="Concluir edição do limite de convidados"
                    title="Concluir edição"
                  >
                    <Check size={14} />
                  </button>
                </>
              ) : (
                <>
                  <strong className="text-slate-700">{guestLimit}</strong>
                  <button
                    type="button"
                    onClick={() => setIsEditingGuestLimit(true)}
                    className="p-1 text-slate-500 hover:text-blue-700"
                    aria-label="Editar limite de convidados"
                    title="Editar limite"
                  >
                    <Edit size={14} />
                  </button>
                </>
              )}
            </div>
            <span className={`basis-full text-center ${remainingSlots < 0 ? 'text-rose-700 font-semibold' : 'text-slate-500'}`}>
              {remainingSlots < 0
                ? `Limite excedido em ${Math.abs(remainingSlots)} convidados`
                : `${remainingSlots} vagas restantes`}
            </span>
          </div>
          <h3 className="text-center text-xl font-semibold text-slate-700 mb-5">Lista de convidados</h3>
          <div className="grid grid-cols-2 divide-x divide-slate-100">
            <div className="flex flex-col items-center text-sky-500">
              <span className="flex items-center gap-2 text-sm sm:text-base font-semibold">
                <CheckCircle size={20} className="fill-sky-400 text-white" />
                Confirmados
              </span>
              <p className="text-4xl sm:text-5xl font-semibold mt-3">{confirmedGuests}</p>
              <p className="text-[10px] text-center text-slate-500 mt-2 px-2">
                Adultos e crianças com idade igual ou superior a {coupleData.buffetPayingAge} anos
              </p>
              <p className="text-[10px] text-center text-slate-500 mt-1 px-2">
                Adultos: {confirmedAdults} | Crianças: {confirmedChildren}
              </p>
            </div>
            <div className="flex flex-col items-center text-slate-400">
              <span className="flex items-center gap-2 text-sm sm:text-base font-semibold">
                <span className="w-5 h-5 rounded-full bg-slate-300 text-white flex items-center justify-center">
                  <X size={14} />
                </span>
                Ausentes
              </span>
              <p className="text-4xl sm:text-5xl font-semibold mt-3">{absentGuests}</p>
            </div>
          </div>
          <p className="text-center text-xs text-slate-500 border-t border-slate-100 mt-5 pt-3">
            Falta confirmar: <strong className="text-slate-700">{pendingGuests}</strong>
          </p>
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
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 border-b border-slate-200 pb-2">
                <div className="flex-1">
                  {editingFamilyId === family.id ? (
                    <form onSubmit={(e) => handleSaveFamily(e, family.id)} className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        aria-label="Nome da família"
                        value={editingFamilyName}
                        onChange={(e) => setEditingFamilyName(e.target.value)}
                        className="flex-1 min-w-36 px-2 py-1 border rounded text-xs"
                        required
                        autoFocus
                      />
                      <input
                        type="tel"
                        aria-label="Telefone usado para verificação"
                        placeholder="Telefone para verificação"
                        value={editingFamilyPhone}
                        onChange={(e) => setEditingFamilyPhone(e.target.value)}
                        className="w-40 px-2 py-1 border rounded text-xs"
                      />
                      <button type="submit" className="px-2.5 py-1 rounded bg-emerald-700 text-white text-xs font-semibold">Salvar</button>
                      <button
                        type="button"
                        onClick={() => setEditingFamilyId(null)}
                        className="px-2.5 py-1 rounded border border-slate-300 text-slate-600 text-xs"
                      >
                        Cancelar
                      </button>
                    </form>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => toggleFamilyExpanded(family.id)}
                        className="flex items-center gap-2 text-left"
                        aria-expanded={!collapsedFamilyIds.includes(family.id)}
                        aria-label={`${collapsedFamilyIds.includes(family.id) ? 'Expandir' : 'Recolher'} ${family.name}`}
                      >
                        <ChevronDown
                          size={15}
                          className={`text-slate-500 transition-transform ${collapsedFamilyIds.includes(family.id) ? '-rotate-90' : ''}`}
                        />
                        <span className="font-bold text-slate-800 text-sm">{family.name}</span>
                      </button>
                      <p className="text-[11px] text-slate-500">
                        {payingMembers.length} pagantes • {freeChildren.length} crianças não-pagantes | Tel: {family.phone || 'Não informado'}
                      </p>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-full">
                    {confirmedCount} / {familyGuests.length} convidados confirmados
                  </span>
                  {adminAccessToken && family.rsvpSubmittedAt && (
                    <button
                      type="button"
                      onClick={() => handleResendGuestQrs(family)}
                      disabled={qrSendState[family.id] === 'Enviando QR codes...'}
                      className="p-1.5 text-slate-500 hover:text-blue-700 disabled:opacity-50"
                      title="Reenviar QR codes dos confirmados"
                      aria-label={`Reenviar QR codes de ${family.name}`}
                    >
                      <Send size={14} />
                    </button>
                  )}
                  {editingFamilyId !== family.id && (
                    <button
                      type="button"
                      onClick={() => handleStartEditingFamily(family)}
                      className="p-1.5 text-slate-500 hover:text-blue-700"
                      title="Editar família"
                      aria-label={`Editar família ${family.name}`}
                    >
                      <Edit size={14} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeleteFamily(family)}
                    className="p-1.5 text-slate-500 hover:text-rose-700"
                    title="Excluir família"
                    aria-label={`Excluir ${family.name}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {qrSendState[family.id] && (
                <p role="status" className="text-[11px] text-slate-600">{qrSendState[family.id]}</p>
              )}

              {!collapsedFamilyIds.includes(family.id) && (
                <>
                  {/* Membros da Família */}
                  <div className="space-y-1.5 pl-2">
                    {family.members.map(m => (
                      <div key={m.id} className="flex justify-between items-center text-xs bg-white p-2 rounded border border-slate-100">
                    {editingMemberId === m.id ? (
                      <form onSubmit={(e) => handleSaveMember(e, family.id, m.id)} className="flex flex-1 flex-wrap items-center gap-2">
                        <input
                          type="text"
                          aria-label="Nome do convidado"
                          value={editingMemberName}
                          onChange={(e) => setEditingMemberName(e.target.value)}
                          className="flex-1 min-w-36 px-2 py-1 border rounded text-xs"
                          required
                          autoFocus
                        />
                        <label className="flex items-center gap-1 text-[11px] text-slate-600">
                          <input
                            type="checkbox"
                            checked={editingMemberIsChild}
                            onChange={(e) => setEditingMemberIsChild(e.target.checked)}
                          />
                          Criança
                        </label>
                        {editingMemberIsChild && (
                          <input
                            type="number"
                            min="0"
                            aria-label="Idade da criança"
                            placeholder="Idade"
                            value={editingMemberAge}
                            onChange={(e) => setEditingMemberAge(e.target.value)}
                            className="w-16 px-2 py-1 border rounded text-xs"
                          />
                        )}
                        <select
                          aria-label={`Status de confirmação de ${m.name}`}
                          value={editingMemberStatus}
                          onChange={(e) => setEditingMemberStatus(e.target.value)}
                          className="px-2 py-1 border rounded text-xs bg-white"
                        >
                          <option value="pending">Pendente</option>
                          <option value="confirmed">Confirmado</option>
                          <option value="absent">Ausente</option>
                        </select>
                        <p className="basis-full text-[11px] text-slate-600">
                          Contato cadastrado para confirmação: <strong>{family.phone || 'Ainda não informado'}</strong>
                          {family.confirmationContact && (
                            <span className="block">Contato adicional já informado: <strong>{family.confirmationContact}</strong></span>
                          )}
                        </p>
                        <button type="submit" className="px-2.5 py-1 rounded bg-emerald-700 text-white text-xs font-semibold">Salvar</button>
                        <button
                          type="button"
                          onClick={() => setEditingMemberId(null)}
                          className="px-2.5 py-1 rounded border border-slate-300 text-slate-600 text-xs"
                        >
                          Cancelar
                        </button>
                      </form>
                    ) : (
                      <>
                        <div>
                          <span className="font-semibold text-slate-700">{m.name}</span>
                          {m.isChild && (
                            <span className="ml-2 text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                              {m.age < coupleData.buffetPayingAge ? `Não-pagante (${m.age} anos)` : `Pagante (${m.age} anos)`}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            m.confirmed === true ? 'bg-emerald-100 text-emerald-800' :
                            m.confirmed === false ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {m.confirmed === true ? 'CONFIRMADO' : m.confirmed === false ? 'AUSENTE' : 'PENDENTE'}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleStartEditingMember(m)}
                            className="p-1 text-slate-500 hover:text-blue-700"
                            title="Editar convidado"
                            aria-label={`Editar ${m.name}`}
                          >
                            <Edit size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMember(family.id, m)}
                            className="p-1 text-slate-500 hover:text-rose-700"
                            title="Excluir convidado"
                            aria-label={`Excluir ${m.name}`}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </>
                    )}
                      </div>
                    ))}
                  </div>

                  {editingFamilyId === family.id && (
                    <AddMemberForm onAdd={(name, isChild, age) => handleAddMember(family.id, name, isChild, age)} />
                  )}
                </>
              )}
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

  const formatMoney = (value) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  const totals = gifts.reduce((acc, gift) => {
    const status = giftQuotas(gift);
    const quotaPrice = gift.price / status.total;
    acc.total += gift.price;
    acc.reserved += quotaPrice * status.reserved;
    acc.gifted += quotaPrice * status.gifted;
    acc.pending += quotaPrice * (status.total - status.reserved - status.gifted);
    return acc;
  }, { total: 0, reserved: 0, gifted: 0, pending: 0 });

  const handleAddGift = (e) => {
    e.preventDefault();
    if (!title.trim() || !price) return;

    const newGift = {
      id: Date.now().toString(),
      title,
      price: Number(price),
      totalQuotas: Number(totalQuotas) || 1,
      giftedQuotas: 0,
      reservedQuotas: 0,
      reservations: [],
      image: image || 'https://images.unsplash.com/photo-1513885535751-8b9238bd345a?auto=format&fit=crop&q=80&w=400',
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200"><span className="text-[10px] uppercase font-semibold text-slate-500">Total da lista</span><p className="text-lg font-serif font-bold text-slate-800">{formatMoney(totals.total)}</p></div>
        <div className="bg-amber-50 p-3 rounded-xl border border-amber-200"><span className="text-[10px] uppercase font-semibold text-amber-700">Reservados</span><p className="text-lg font-serif font-bold text-amber-900">{formatMoney(totals.reserved)}</p></div>
        <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200"><span className="text-[10px] uppercase font-semibold text-emerald-700">Já presenteados</span><p className="text-lg font-serif font-bold text-emerald-900">{formatMoney(totals.gifted)}</p></div>
        <div className="bg-blue-50 p-3 rounded-xl border border-blue-200"><span className="text-[10px] uppercase font-semibold text-blue-700">Ainda não foram</span><p className="text-lg font-serif font-bold text-blue-900">{formatMoney(totals.pending)}</p></div>
      </div>

      {/* Form de Adicionar Presente */}
      <form onSubmit={handleAddGift} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
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
        <div>
          <label className="block text-[11px] font-semibold text-slate-700 mb-1">Imagem pela web (URL)</label>
          <input type="url" placeholder="https://..." value={image.startsWith('data:') ? '' : image} onChange={(e) => setImage(e.target.value)} className="w-full p-2 border rounded text-xs" />
          <label className="block text-[10px] text-slate-500 mt-2">ou selecione do computador</label>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={(e) => {
              const file = e.target.files[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = (event) => setImage(event.target.result);
              reader.readAsDataURL(file);
            }}
            className="w-full p-1 border rounded text-[10px] file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-[#4A5D4E] file:text-white file:text-[10px]"
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
              <th className="py-2">Apuração / Quem reservou ou presenteou</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {gifts.map(g => (
              <tr key={g.id}>
                <td className="py-2.5 font-semibold text-slate-800">{g.title}</td>
                <td className="py-2.5">R$ {g.price.toLocaleString('pt-BR')}</td>
                <td className="py-2.5">{(g.giftedQuotas || 0) + (g.reservedQuotas || 0)} / {g.totalQuotas}</td>
                <td className="py-2.5 text-slate-600">
                  {(g.reservations || []).map(reservation => (
                    <div key={reservation.id} className="text-[11px]">
                      {reservation.name} ({reservation.quotas} cota{reservation.quotas > 1 ? 's' : ''}) — {reservation.status === 'gifted' ? 'presenteado' : 'reservado'}
                      {reservation.status === 'reserved' && (reservation.email || reservation.whatsapp) && (
                        <span className="block text-slate-500">
                          {[reservation.email, reservation.whatsapp].filter(Boolean).join(' | ')}
                        </span>
                      )}
                    </div>
                  ))}
                  {!g.reservations?.length && <span className="text-slate-400">Disponível</span>}
                </td>
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
  const [editingId, setEditingId] = useState(null);
  const [supplierForm, setSupplierForm] = useState({ name: '', category: '', agreedValue: '' });

  const resetSupplierForm = () => {
    setEditingId(null);
    setSupplierForm({ name: '', category: '', agreedValue: '' });
  };

  const saveSupplier = (e) => {
    e.preventDefault();
    if (!supplierForm.name.trim() || !supplierForm.agreedValue) return;

    if (editingId) {
      setFinancials({
        ...financials,
        suppliers: financials.suppliers.map(s => s.id === editingId
          ? { ...s, name: supplierForm.name.trim(), category: supplierForm.category.trim(), agreedValue: Number(supplierForm.agreedValue) }
          : s)
      });
    } else {
      setFinancials({
        ...financials,
        suppliers: [...financials.suppliers, {
          id: Date.now().toString(),
          name: supplierForm.name.trim(),
          category: supplierForm.category.trim() || 'Outros',
          agreedValue: Number(supplierForm.agreedValue),
          installments: [{ number: 1, value: Number(supplierForm.agreedValue), dueDate: '', paid: false }]
        }]
      });
    }
    resetSupplierForm();
  };

  const startEditSupplier = (supplier) => {
    setEditingId(supplier.id);
    setSupplierForm({ name: supplier.name, category: supplier.category, agreedValue: supplier.agreedValue });
  };

  const deleteSupplier = (supplierId) => {
    if (!window.confirm('Excluir este fornecedor e suas parcelas?')) return;
    setFinancials({ ...financials, suppliers: financials.suppliers.filter(s => s.id !== supplierId) });
    if (editingId === supplierId) resetSupplierForm();
  };

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
          <div className="flex items-center gap-1 mt-1">
            <span className="text-xs text-slate-500">R$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={financials.targetBudget}
              onChange={(e) => setFinancials({ ...financials, targetBudget: Number(e.target.value) || 0 })}
              className="w-32 px-2 py-1 border border-slate-300 rounded text-right text-sm font-bold text-slate-800 bg-white"
            />
          </div>
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

      <form onSubmit={saveSupplier} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-bold text-slate-800">{editingId ? 'Editar fornecedor' : 'Adicionar fornecedor'}</h3>
          {editingId && <button type="button" onClick={resetSupplierForm} className="text-xs text-slate-500 underline">Cancelar edição</button>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input type="text" placeholder="Nome do fornecedor" value={supplierForm.name} onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })} className="p-2 border rounded text-xs" required />
          <input type="text" placeholder="Categoria" value={supplierForm.category} onChange={(e) => setSupplierForm({ ...supplierForm, category: e.target.value })} className="p-2 border rounded text-xs" />
          <input type="number" min="0" step="0.01" placeholder="Valor contratado (R$)" value={supplierForm.agreedValue} onChange={(e) => setSupplierForm({ ...supplierForm, agreedValue: e.target.value })} className="p-2 border rounded text-xs" required />
        </div>
        <button type="submit" className="bg-[#4A5D4E] hover:bg-[#364539] text-white px-4 py-2 rounded text-xs font-semibold">
          {editingId ? 'Salvar alterações' : '+ Adicionar fornecedor'}
        </button>
      </form>

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
                <div className="flex items-center gap-3">
                  <div className="text-right">
                  <span className="text-xs font-bold text-slate-800">Fechado: R$ {s.agreedValue.toLocaleString('pt-BR')}</span>
                  <p className="text-[10px] text-emerald-700">Pago: R$ {supplierPaid.toLocaleString('pt-BR')}</p>
                  </div>
                  <button onClick={() => startEditSupplier(s)} className="p-1.5 text-slate-500 hover:text-blue-700" title="Editar fornecedor"><Edit size={14} /></button>
                  <button onClick={() => deleteSupplier(s.id)} className="p-1.5 text-slate-500 hover:text-rose-700" title="Excluir fornecedor"><Trash2 size={14} /></button>
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

const DEFAULT_AVOID_ITEMS = ['Roupas esportivas', 'Bermudas', 'Regatas', 'Chinelos', 'Tênis de corrida', 'Jeans rasgados'];

function DressCodeTab({ coupleData, setCoupleData }) {
  const current = coupleData.dressCode || {};
  const [styles, setStyles] = useState(current.styles || ['Esporte Fino']);
  const [description, setDescription] = useState(current.description || '');
  const [forbiddenColors, setForbiddenColors] = useState(current.forbiddenColors || []);
  const [avoidItems, setAvoidItems] = useState(current.avoidItems || []);
  const [customStyle, setCustomStyle] = useState('');
  const [customAvoidItem, setCustomAvoidItem] = useState('');
  const [customColorName, setCustomColorName] = useState('');
  const [customColorValue, setCustomColorValue] = useState('#D9D9D9');

  const toggleValue = (list, value, setter) => setter(list.includes(value) ? list.filter(item => item !== value) : [...list, value]);
  const addStyle = () => { const value = customStyle.trim(); if (value && !styles.includes(value)) setStyles([...styles, value]); setCustomStyle(''); };
  const addAvoidItem = () => { const value = customAvoidItem.trim(); if (value && !avoidItems.includes(value)) setAvoidItems([...avoidItems, value]); setCustomAvoidItem(''); };
  const addColor = () => { const name = customColorName.trim(); if (name && !forbiddenColors.some(color => color.name === name)) setForbiddenColors([...forbiddenColors, { name, value: customColorValue }]); setCustomColorName(''); };
  const saveDressCode = () => {
    setCoupleData({ ...coupleData, dressCode: { styles, description, forbiddenColors, avoidItems } });
    alert('Dress Code atualizado com sucesso!');
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm max-w-4xl mx-auto space-y-6">
      <div><h2 className="text-xl font-serif font-bold text-slate-800">Editar Dress Code</h2><p className="text-xs text-slate-500 mt-1">Escolha o estilo, as cores proibidas e as roupas que devem ser evitadas.</p></div>
      <section className="space-y-3">
        <h3 className="text-sm font-bold text-slate-800">Tipo de traje</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {Object.keys(DRESS_CODE_OPTIONS).map(option => <label key={option} className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 text-xs cursor-pointer"><input type="checkbox" checked={styles.includes(option)} onChange={() => toggleValue(styles, option, setStyles)} />{option}</label>)}
          {styles.filter(style => !DRESS_CODE_OPTIONS[style]).map(style => <label key={style} className="flex items-center gap-2 p-2.5 rounded-lg border border-emerald-200 bg-emerald-50 text-xs cursor-pointer"><input type="checkbox" checked onChange={() => toggleValue(styles, style, setStyles)} />{style} (personalizado)</label>)}
        </div>
        <div className="flex gap-2"><input value={customStyle} onChange={(e) => setCustomStyle(e.target.value)} placeholder="Adicionar tipo personalizado" className="flex-1 p-2 border rounded text-xs" /><button type="button" onClick={addStyle} className="bg-slate-700 text-white px-3 rounded text-xs font-semibold">Adicionar</button></div>
      </section>
      <section className="space-y-3"><h3 className="text-sm font-bold text-slate-800">Descrição automática</h3><p className="text-xs text-slate-500">Deixe em branco para o site gerar o texto com base nas opções.</p><textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={getDressCodeText({ styles, avoidItems })} rows="3" className="w-full p-2 border rounded text-xs" /></section>
      <section className="space-y-3">
        <h3 className="text-sm font-bold text-slate-800">Cores proibidas ou reservadas</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">{forbiddenColors.map((color, index) => <div key={`${color.name}-${index}`} className="flex items-center gap-2 p-2 border rounded-lg text-xs"><input type="color" value={color.value} onChange={(e) => setForbiddenColors(forbiddenColors.map((item, i) => i === index ? { ...item, value: e.target.value } : item))} className="w-8 h-7" /><input value={color.name} onChange={(e) => setForbiddenColors(forbiddenColors.map((item, i) => i === index ? { ...item, name: e.target.value } : item))} className="flex-1 p-1 border rounded text-xs" /><button type="button" onClick={() => setForbiddenColors(forbiddenColors.filter((_, i) => i !== index))} className="text-rose-600 text-xs">Excluir</button></div>)}</div>
        <div className="flex gap-2"><input value={customColorName} onChange={(e) => setCustomColorName(e.target.value)} placeholder="Nome da cor" className="flex-1 p-2 border rounded text-xs" /><input type="color" value={customColorValue} onChange={(e) => setCustomColorValue(e.target.value)} className="w-12 border rounded" /><button type="button" onClick={addColor} className="bg-slate-700 text-white px-3 rounded text-xs font-semibold">Adicionar</button></div>
      </section>
      <section className="space-y-3">
        <h3 className="text-sm font-bold text-slate-800">Roupas e itens a evitar</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">{[...new Set([...DEFAULT_AVOID_ITEMS, ...avoidItems])].map(item => <label key={item} className="flex items-center gap-2 p-2 border rounded-lg text-xs cursor-pointer"><input type="checkbox" checked={avoidItems.includes(item)} onChange={() => toggleValue(avoidItems, item, setAvoidItems)} />{item}</label>)}</div>
        <div className="flex gap-2"><input value={customAvoidItem} onChange={(e) => setCustomAvoidItem(e.target.value)} placeholder="Adicionar item personalizado" className="flex-1 p-2 border rounded text-xs" /><button type="button" onClick={addAvoidItem} className="bg-slate-700 text-white px-3 rounded text-xs font-semibold">Adicionar</button></div>
      </section>
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3"><span className="text-[10px] uppercase font-semibold text-slate-500">Prévia no site dos convidados</span><p className="text-xs text-slate-700 mt-1">{getDressCodeText({ styles, description, avoidItems })}</p></div>
      <button type="button" onClick={saveDressCode} className="bg-[#4A5D4E] hover:bg-[#364539] text-white px-6 py-2.5 rounded-lg text-xs font-semibold shadow transition">Salvar Dress Code</button>
    </div>
  );
}

/* --- SUB-ABA: ESTILIZAÇÃO DO SITE --- */
function StylingTab({ coupleData, setCoupleData }) {
  const [palette, setPalette] = useState({ ...DEFAULT_GUEST_PALETTE, ...(coupleData.guestPalette || {}) });
  const [font, setFont] = useState(coupleData.guestFont || 'Inter');
  const [carouselImages, setCarouselImages] = useState(coupleData.guestCarouselImages || [coupleData.coverImage]);
  const [imageUrl, setImageUrl] = useState('');
  const presetPalettes = {
    jardim: { ...DEFAULT_GUEST_PALETTE },
    boho: { ...DEFAULT_GUEST_PALETTE, primary: '#8C6D58', primaryHover: '#6E5443', background: '#FAF6F0', card: '#FFFDF9', border: '#E0D3C3' },
    minimalista: { ...DEFAULT_GUEST_PALETTE, primary: '#2B2B2B', primaryHover: '#111111', background: '#F9F9F9', card: '#FFFFFF', border: '#E5E5E5' }
  };
  const updatePalette = (name, value) => setPalette({ ...palette, [name]: value });
  const addCarouselImage = (source) => { if (source) { setCarouselImages([...carouselImages, source]); setImageUrl(''); } };
  const saveStyling = () => {
    setCoupleData({ ...coupleData, guestPalette: palette, guestFont: font, guestCarouselImages: carouselImages });
    alert('Estilização e fotos atualizadas com sucesso!');
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm max-w-2xl mx-auto space-y-6">
      <h2 className="text-xl font-serif font-bold text-slate-800">Estilização e Tema do Site</h2>

      <div className="space-y-4">
        <label className="block text-xs font-semibold text-slate-700">Escolha o Tema Visual:</label>

        <div className="grid grid-cols-3 gap-4">
          {Object.values(THEMES).map(t => (
            <button
              key={t.id}
              onClick={() => {
                setPalette(presetPalettes[t.id]);
                setCoupleData({ ...coupleData, selectedTheme: t.id });
              }}
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

      <div className="border-t border-slate-200 pt-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-800">Paleta de cores personalizada</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            ['primary', 'Cor principal'], ['primaryHover', 'Cor ao passar o mouse'],
            ['background', 'Fundo do site'], ['card', 'Fundo dos cartões'],
            ['text', 'Texto principal'], ['muted', 'Texto secundário'], ['border', 'Bordas']
          ].map(([name, label]) => (
            <label key={name} className="text-[11px] font-semibold text-slate-700">
              {label}
              <div className="flex items-center gap-2 mt-1">
                <input type="color" value={palette[name]} onChange={(e) => updatePalette(name, e.target.value)} className="h-8 w-10 cursor-pointer rounded border" />
                <input type="text" value={palette[name]} onChange={(e) => updatePalette(name, e.target.value)} className="w-full p-1.5 border rounded text-xs uppercase" />
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="border-t border-slate-200 pt-5">
        <label className="block text-sm font-bold text-slate-800 mb-2">Fonte do site dos convidados</label>
        <select value={font} onChange={(e) => setFont(e.target.value)} className="w-full md:w-80 p-2 border rounded text-sm">
          <option value="Inter">Inter</option>
          <option value="Playfair Display">Playfair Display</option>
          <option value="Georgia">Georgia</option>
          <option value="Arial">Arial</option>
          <option value="Verdana">Verdana</option>
        </select>
      </div>

      <div className="border-t border-slate-200 pt-5 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Fotos do carrossel</h3>
          <p className="text-xs text-slate-500 mt-1">Adicione imagens pela internet ou faça upload do computador.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div className="flex gap-2">
            <input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="URL da imagem" className="flex-1 p-2 border rounded text-xs" />
            <button type="button" onClick={() => addCarouselImage(imageUrl)} className="bg-slate-700 text-white px-3 rounded text-xs font-semibold">Adicionar URL</button>
          </div>
          <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => addCarouselImage(event.target.result);
            reader.readAsDataURL(file);
            e.target.value = '';
          }} className="p-1 border rounded text-[10px] file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-[#4A5D4E] file:text-white file:text-[10px]" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {carouselImages.map((image, index) => (
            <div key={`${image}-${index}`} className="relative rounded-lg overflow-hidden border border-slate-200">
              <img src={image} alt={`Carrossel ${index + 1}`} className="w-full h-28 object-cover" />
              <button type="button" onClick={() => setCarouselImages(carouselImages.filter((_, imageIndex) => imageIndex !== index))} className="absolute top-1 right-1 bg-rose-600 text-white rounded px-1.5 py-1 text-[10px]">Remover</button>
            </div>
          ))}
        </div>
      </div>

      <button type="button" onClick={saveStyling} className="bg-[#4A5D4E] hover:bg-[#364539] text-white px-6 py-2.5 rounded-lg text-xs font-semibold shadow transition">Salvar estilização</button>
    </div>
  );
}
