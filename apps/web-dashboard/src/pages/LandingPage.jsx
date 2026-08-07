import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import {
  Phone, MessageCircle, Users, Zap, Settings2,
  ChevronDown, Star, Play, ArrowRight,
  CheckCircle2, Shield, Clock, Globe, Target,
  PhoneCall, MessageSquare, UserPlus, Bot, Send, Megaphone,
  PieChart, TrendingUp
} from 'lucide-react'
import heroDashboard from '../assets/hero-dashboard.png'
import './landing.css'

/* ────────────────────────── DATA ────────────────────────── */

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'Pricing', href: '/pricing', isRoute: true },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Testimonials', href: '#testimonials' },
  { label: 'FAQ', href: '#faq' },
]

const STATS = [
  { value: '10,000+', label: 'Active Users' },
  { value: '50M+', label: 'Leads Managed' },
  { value: '99.9%', label: 'Uptime' },
  { value: '4.8★', label: 'User Rating' },
]

const FEATURE_SECTIONS = [
  {
    id: 'calling',
    title: 'Calling features that give you wings',
    subtitle: 'Fast, accurate calling, complete tracking',
    tabs: [
      {
        key: '1-click-dialer', label: '1-Click Dialer', icon: PhoneCall,
        heading: '1-Click Dialer',
        points: ['More calls = more deals', 'Less confusion = more calls', 'With 1-click dialer, you don\'t have to think about who to call next'],
      },
      {
        key: 'reminders', label: 'Reminders', icon: Clock,
        heading: 'Smart Reminders',
        points: ['Never miss a follow-up again', 'Automated callback scheduling', 'Priority-based call queue management'],
      },
      {
        key: 'tracking', label: 'Tracking', icon: Target,
        heading: 'Call Tracking',
        points: ['Track every call in real-time', 'Monitor team performance daily', 'Detailed call analytics and reports'],
      },
      {
        key: 'recording', label: 'Recording', icon: Shield,
        heading: 'Call Recording',
        points: ['Record every sales call automatically', 'Review calls for quality assurance', 'Train new team members with best examples'],
      },
    ],
  },
  {
    id: 'whatsapp',
    title: 'Connect with leads on their favourite platform',
    subtitle: 'With all the important WhatsApp features and automation',
    tabs: [
      {
        key: 'templates', label: 'Templates', icon: MessageSquare,
        heading: 'Message Templates',
        points: ['Send personalised messages to leads within seconds', 'Pre-approved templates for instant outreach', 'Dynamic variables for personalization'],
      },
      {
        key: '1-click-wa', label: '1-Click', icon: Send,
        heading: '1-Click WhatsApp',
        points: ['Send WhatsApp messages with a single click', 'No need to save contacts manually', 'Seamless integration with your lead list'],
      },
      {
        key: 'chatbot', label: 'Chatbot', icon: Bot,
        heading: 'WhatsApp Chatbot',
        points: ['Auto-respond to incoming messages 24/7', 'Qualify leads automatically', 'Route conversations to the right agent'],
      },
      {
        key: 'broadcast', label: 'Broadcasting', icon: Megaphone,
        heading: 'Bulk Broadcasting',
        points: ['Send messages to thousands of leads at once', 'Schedule campaigns for optimal timing', 'Track delivery, read, and response rates'],
      },
    ],
  },
  {
    id: 'leads',
    title: 'Get leads from everywhere in one place',
    subtitle: 'Without doing anything at all',
    tabs: [
      {
        key: 'website', label: 'Website', icon: Globe,
        heading: 'Website Leads',
        points: ['Capture website leads in real-time', 'Track every call, message, and follow-up', 'Close more deals with a central lead hub'],
      },
      {
        key: 'facebook', label: 'Facebook', icon: Users,
        heading: 'Facebook Leads',
        points: ['Auto-import leads from Facebook Ads', 'Instant notification on new lead', 'Assign leads to agents automatically'],
      },
      {
        key: 'whatsappLead', label: 'WhatsApp', icon: MessageCircle,
        heading: 'WhatsApp Leads',
        points: ['Capture leads from WhatsApp conversations', 'Convert chats into actionable leads', 'Full conversation history in one place'],
      },
      {
        key: 'others', label: 'Others', icon: Zap,
        heading: 'Other Sources',
        points: ['Import from Google Sheets & CSV files', 'Connect with 100+ integrations via API', 'Manual lead entry with smart forms'],
      },
    ],
  },
  {
    id: 'automation',
    title: 'Automation for repetitive tasks',
    subtitle: 'So that your team can focus on important work',
    tabs: [
      {
        key: 'welcome', label: 'Welcome Message', icon: MessageSquare,
        heading: 'Welcome Message',
        points: ['Send automated welcome message to all leads', 'Connect with leads immediately on WhatsApp', 'Create the perfect channel for future follow-ups'],
      },
      {
        key: 'assignment', label: 'Lead Assignment', icon: UserPlus,
        heading: 'Auto Lead Assignment',
        points: ['Assign leads to agents automatically', 'Round-robin or skill-based distribution', 'Reduce response time by 80%'],
      },
      {
        key: 'scheduling', label: 'Scheduling', icon: Clock,
        heading: 'Smart Scheduling',
        points: ['Schedule calls and messages in advance', 'Automated drip campaigns', 'Time-zone aware scheduling'],
      },
      {
        key: 'drip', label: 'Drip Marketing', icon: TrendingUp,
        heading: 'Drip Marketing',
        points: ['Create multi-step follow-up sequences', 'Personalized messaging at scale', 'Track engagement and optimize campaigns'],
      },
    ],
  },
]

const ANALYTICS_FEATURES = [
  { icon: Users, title: 'People', desc: 'Track team performance and agent productivity metrics' },
  { icon: Phone, title: 'Calls', desc: 'Analyze call patterns, duration, and conversion rates' },
  { icon: TrendingUp, title: 'Sales', desc: 'Monitor revenue, pipeline value, and deal velocity' },
  { icon: PieChart, title: 'Custom Reports', desc: 'Build custom dashboards tailored to your needs' },
]

const HOW_IT_WORKS = [
  { step: 1, icon: UserPlus, title: 'Sign Up Free', desc: 'Create your account in seconds. No credit card required.' },
  { step: 2, icon: Settings2, title: 'Configure', desc: 'Set up your team, branches, and custom pipeline stages.' },
  { step: 3, icon: Users, title: 'Import Leads', desc: 'Import existing leads or capture new ones automatically.' },
  { step: 4, icon: TrendingUp, title: 'Start Selling', desc: 'Call, message, and close deals — all from one platform.' },
]

const TESTIMONIALS = [
  {
    quote: 'SparkCRM transformed our sales process. We\'ve seen a 40% increase in conversions since we started using it.',
    name: 'Priyanka Mehra',
    role: 'Sales Director at TechVista',
    stars: 5,
  },
  {
    quote: 'The WhatsApp integration is a game-changer. Our team can now reach leads on their preferred channel instantly.',
    name: 'Rajesh Iyer',
    role: 'VP Sales at NexusDigital',
    stars: 5,
  },
  {
    quote: 'I can audit 100% of my team\'s sales calls now. The recording and analytics features are incredible.',
    name: 'Sneha Kapoor',
    role: 'Head of Sales at CloudNine',
    stars: 5,
  },
  {
    quote: 'We switched from 3 different tools to just SparkCRM. Everything is in one place now.',
    name: 'Arjun Patel',
    role: 'CEO at GreenTech Solutions',
    stars: 5,
  },
]

const FAQ_ITEMS = [
  { q: 'What is SparkCRM?', a: 'SparkCRM is an all-in-one sales CRM platform that combines lead management, phone calling, WhatsApp messaging, meetings, and analytics into a single powerful tool built for Indian sales teams.' },
  { q: 'Is there a free plan?', a: 'Yes! You can sign up for a free plan with no credit card required. You get access to core features including lead management, calling, and basic analytics.' },
  { q: 'How does automatic lead capture work?', a: 'SparkCRM automatically captures leads from your website forms, Facebook ads, WhatsApp messages, and other sources. Leads are instantly added to your pipeline and assigned to agents.' },
  { q: 'Can I import my existing leads?', a: 'Absolutely. You can import leads from CSV files, Google Sheets, or any other CRM. Our import wizard makes the process simple and fast.' },
  { q: 'Is my data secure?', a: 'Yes. We use enterprise-grade encryption, role-based access controls, and branch-level data isolation to keep your data safe. Your leads are never shared with anyone.' },
  { q: 'How does the calling feature work?', a: 'SparkCRM\'s 1-click dialer lets agents make calls directly from the CRM. All calls are tracked, recorded, and linked to the lead profile for complete visibility.' },
]

/* ────────────────────────── COMPONENTS ────────────────────────── */

function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav className={`landing-nav ${scrolled ? 'scrolled' : ''}`}>
      <div className="landing-container nav-inner">
        <Link to="/" className="nav-logo">⚡ SparkCRM</Link>
        <div className="nav-links">
          {NAV_LINKS.map((l) => (
            l.isRoute
              ? <Link key={l.href} to={l.href} className="nav-link">{l.label}</Link>
              : <a key={l.href} href={l.href} className="nav-link">{l.label}</a>
          ))}
          <Link to="/pricing" className="nav-cta">Try It Free <ArrowRight size={16} /></Link>
        </div>
      </div>
    </nav>
  )
}

function Hero() {
  return (
    <section className="hero-section">
      <div className="hero-bg-orbs">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>
      <div className="landing-container hero-inner">
        <div className="hero-text">
          <div className="hero-badge">🚀 #1 CRM for Sales Teams</div>
          <h1>Build an efficient<br /><span className="hero-gradient-text">sales system</span> for your team</h1>
          <p className="hero-sub">
            With lead management, phone calls, meetings, and WhatsApp communication managed on a single platform.
          </p>
          <div className="hero-ctas">
            <Link to="/pricing" className="btn-primary-lg">
              Try It Free <ArrowRight size={18} />
            </Link>
            <a href="#features" className="btn-ghost-lg">
              <Play size={18} /> See How It Works
            </a>
          </div>
          <div className="hero-trust">
            <CheckCircle2 size={16} className="trust-check" />
            <span>Free forever plan</span>
            <span className="trust-dot">•</span>
            <span>No credit card required</span>
            <span className="trust-dot">•</span>
            <span>Setup in 2 minutes</span>
          </div>
        </div>
        <div className="hero-image">
          <div className="hero-image-glow" />
          <img src={heroDashboard} alt="SparkCRM Dashboard" />
        </div>
      </div>
    </section>
  )
}

function StatsBar() {
  return (
    <section className="stats-bar">
      <div className="landing-container stats-inner">
        {STATS.map((s, i) => (
          <div key={i} className="stat-item">
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

function FeatureTabSection({ section, reverse }) {
  const [active, setActive] = useState(0)
  const tab = section.tabs[active]
  const Icon = tab.icon

  return (
    <section className="feature-section" id={section.id === 'calling' ? 'features' : undefined}>
      <div className="landing-container">
        <div className="section-header">
          <h2>{section.title}</h2>
          <p>{section.subtitle}</p>
        </div>
        <div className="feature-tabs">
          {section.tabs.map((t, i) => (
            <button
              key={t.key}
              className={`feature-tab ${i === active ? 'active' : ''}`}
              onClick={() => setActive(i)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className={`feature-content ${reverse ? 'reverse' : ''}`}>
          <div className="feature-visual">
            <div className="feature-icon-circle">
              <Icon size={48} />
            </div>
          </div>
          <div className="feature-detail">
            <h3>{tab.heading}</h3>
            <ul className="feature-points">
              {tab.points.map((p, i) => (
                <li key={i}><CheckCircle2 size={18} className="point-check" /> {p}</li>
              ))}
            </ul>
            <Link to="/pricing" className="btn-primary">Try It Free <ArrowRight size={16} /></Link>
          </div>
        </div>
      </div>
    </section>
  )
}

function AnalyticsSection() {
  return (
    <section className="analytics-section">
      <div className="landing-container">
        <div className="section-header dark">
          <h2>Analytics to measure what matters</h2>
          <p>Track, monitor, compare and incentivize your team's performance</p>
        </div>
        <div className="analytics-grid">
          {ANALYTICS_FEATURES.map((f, i) => (
            <div key={i} className="analytics-card">
              <div className="analytics-icon"><f.icon size={28} /></div>
              <h4>{f.title}</h4>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function HowItWorks() {
  return (
    <section className="how-section" id="how-it-works">
      <div className="landing-container">
        <div className="section-header">
          <h2>Get started in minutes</h2>
          <p>Four simple steps to transform your sales process</p>
        </div>
        <div className="steps-grid">
          {HOW_IT_WORKS.map((s) => (
            <div key={s.step} className="step-card">
              <div className="step-number">{s.step}</div>
              <div className="step-icon"><s.icon size={28} /></div>
              <h4>{s.title}</h4>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Testimonials() {
  const [current, setCurrent] = useState(0)
  const maxVisible = 2
  const canPrev = current > 0
  const canNext = current + maxVisible < TESTIMONIALS.length

  return (
    <section className="testimonials-section" id="testimonials">
      <div className="landing-container">
        <div className="section-header">
          <h2>Testimonials</h2>
          <p>What our users say</p>
        </div>
        <div className="testimonials-wrapper">
          <button className={`test-arrow left ${!canPrev ? 'disabled' : ''}`} onClick={() => canPrev && setCurrent(c => c - 1)}>‹</button>
          <div className="testimonials-track">
            {TESTIMONIALS.slice(current, current + maxVisible).map((t, i) => (
              <div key={i} className="testimonial-card">
                <div className="testimonial-quote">"{t.quote}"</div>
                <div className="testimonial-author">
                  <div className="testimonial-avatar">{t.name.charAt(0)}</div>
                  <div>
                    <div className="testimonial-name">{t.name}</div>
                    <div className="testimonial-role">{t.role}</div>
                    <div className="testimonial-stars">
                      {Array.from({ length: t.stars }).map((_, j) => <Star key={j} size={14} fill="#f59e0b" color="#f59e0b" />)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button className={`test-arrow right ${!canNext ? 'disabled' : ''}`} onClick={() => canNext && setCurrent(c => c + 1)}>›</button>
        </div>
      </div>
    </section>
  )
}

function FaqSection() {
  const [open, setOpen] = useState(null)

  return (
    <section className="faq-section" id="faq">
      <div className="landing-container">
        <div className="section-header">
          <h2>FAQs</h2>
        </div>
        <div className="faq-list">
          {FAQ_ITEMS.map((item, i) => (
            <div key={i} className={`faq-item ${open === i ? 'open' : ''}`}>
              <button className="faq-question" onClick={() => setOpen(open === i ? null : i)}>
                {item.q}
                <ChevronDown size={20} className="faq-chevron" />
              </button>
              {open === i && <div className="faq-answer">{item.a}</div>}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function FooterCta() {
  return (
    <section className="footer-cta-section">
      <div className="landing-container footer-cta-inner">
        <h2>Ready to supercharge your sales?</h2>
        <p>Join thousands of teams already using SparkCRM to close more deals faster.</p>
        <div className="footer-cta-buttons">
          <Link to="/pricing" className="btn-primary-lg">Try It Free <ArrowRight size={18} /></Link>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  const columns = [
    {
      title: 'Product',
      links: [
        { label: 'Lead Management', href: '#features' },
        { label: 'Calling', href: '#features' },
        { label: 'WhatsApp CRM', href: '#features' },
        { label: 'Automations', href: '#features' },
        { label: 'Analytics', href: '#features' },
      ],
    },
    {
      title: 'Company',
      links: [
        { label: 'About Us', href: '#' },
        { label: 'Blog', href: '#' },
        { label: 'Careers', href: '#' },
        { label: 'Contact', href: '#' },
      ],
    },
    {
      title: 'Support',
      links: [
        { label: 'Help Center', href: '#' },
        { label: 'API Docs', href: '#' },
        { label: 'Status', href: '#' },
        { label: 'Security', href: '#' },
      ],
    },
    {
      title: 'Legal',
      links: [
        { label: 'Privacy Policy', href: '#' },
        { label: 'Terms of Service', href: '#' },
        { label: 'Cookie Policy', href: '#' },
      ],
    },
  ]

  return (
    <footer className="landing-footer">
      <div className="landing-container">
        <div className="footer-grid">
          <div className="footer-brand">
            <div className="nav-logo">⚡ SparkCRM</div>
            <p>Build efficient sales systems for your team with lead management, calling, WhatsApp, and analytics on a single platform.</p>
          </div>
          {columns.map((col) => (
            <div key={col.title} className="footer-col">
              <h5>{col.title}</h5>
              {col.links.map((l) => (
                <a key={l.label} href={l.href}>{l.label}</a>
              ))}
            </div>
          ))}
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} SparkCRM. All rights reserved.</span>
        </div>
      </div>
    </footer>
  )
}

/* ────────────────────────── MAIN PAGE ────────────────────────── */

export default function LandingPage() {
  const { isAuthenticated } = useSelector((s) => s.auth)
  const navigate = useNavigate()

  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true })
  }, [isAuthenticated, navigate])

  if (isAuthenticated) return null

  return (
    <div className="landing-page">
      <Navbar />
      <Hero />
      <StatsBar />
      {FEATURE_SECTIONS.map((s, i) => (
        <FeatureTabSection key={s.id} section={s} reverse={i % 2 === 1} />
      ))}
      <AnalyticsSection />
      <HowItWorks />
      <Testimonials />
      <FaqSection />
      <FooterCta />
      <Footer />
    </div>
  )
}
