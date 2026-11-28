export const DEFAULT_SITE_CONTENT = {
  hero: {
    eyebrow: 'Diseño web para negocios reales',
    title: 'Tu negocio merece una web que',
    accent: 'trabaje por ti',
    description:
      'Creamos sitios modernos, rápidos y pensados para convertir visitas en clientes. Diseño a medida, acompañamiento cercano y precios claros.',
    primaryCta: 'Ver planes',
    secondaryCta: 'Hablar por WhatsApp',
    points: ['Diseño a medida', '100% adaptable', 'Trato directo'],
  },
  services: {
    eyebrow: 'Lo que hacemos',
    title: 'Una presencia digital',
    accent: 'a tu altura',
    description:
      'No se trata solo de tener una página: se trata de que represente tu negocio y facilite que las personas te contacten.',
  },
  benefits: [
    {
      title: 'Diseño a medida',
      text: 'Una imagen alineada a tu marca y a lo que quieres comunicar.',
    },
    {
      title: '100% adaptable',
      text: 'Se ve bien en celulares, tablets y pantallas de escritorio.',
    },
    {
      title: 'SEO básico',
      text: 'Bases sólidas para que te encuentren en los buscadores.',
    },
    {
      title: 'Trato directo',
      text: 'Acompañamiento cercano desde la idea hasta la publicación.',
    },
  ],
  catalog: {
    eyebrow: 'Catálogo tecnológico',
    title: 'Equipos con',
    accent: 'características claras',
    description:
      'Explora laptops, monitores y accesorios en una página dedicada, filtra por marca o modelo y revisa sus especificaciones antes de consultar.',
    cta: 'Ver catálogo',
  },
  plans: {
    eyebrow: 'Planes y precios',
    title: 'Elige el punto de partida',
    accent: 'de tu web',
    description:
      'Opciones claras para diferentes etapas de tu negocio. Si no sabes cuál elegir, conversamos y te orientamos sin compromiso.',
  },
  planItems: [
    {
      name: 'Web Emprendedor',
      price: '$350.000',
      tagline: 'Ideal para empezar con una presencia profesional.',
      features: [
        'Página de una sola sección larga',
        'Adaptación a celulares',
        'Botón de WhatsApp',
        'Formulario de contacto',
        'Diseño basado en plantilla',
      ],
      featured: false,
    },
    {
      name: 'Web Empresarial',
      price: '$650.000 – $900.000',
      tagline: 'Para negocios que necesitan mostrar más y vender mejor.',
      features: [
        'Hasta 5 secciones',
        'Inicio, nosotros, servicios y contacto',
        'Galería de imágenes',
        'Diseño adaptable',
        'SEO básico',
      ],
      featured: true,
    },
    {
      name: 'Tienda Virtual',
      price: '$1.200.000 – $1.800.000',
      tagline: 'Tu catálogo y tus ventas en línea, listos para crecer.',
      features: [
        'Catálogo de productos',
        'Carrito de compras',
        'Contacto por WhatsApp',
        'Configuración inicial',
        'Capacitación básica',
      ],
      featured: false,
    },
  ],
  plansNote:
    'Dominio, hosting y servicios externos se cotizan por separado.',
  process: {
    eyebrow: 'Cómo trabajamos',
    title: 'De la idea a tu web',
    accent: 'en cuatro pasos',
    description:
      'Un proceso sencillo, con comunicación directa y sin sorpresas en el camino.',
  },
  steps: [
    {
      title: 'Conversamos',
      text: 'Entendemos tu negocio, tus objetivos y lo que necesitas comunicar.',
    },
    {
      title: 'Propuesta',
      text: 'Definimos alcance, tiempos y precio antes de empezar.',
    },
    {
      title: 'Diseño y desarrollo',
      text: 'Construimos tu sitio y lo revisamos juntos paso a paso.',
    },
    {
      title: 'Publicación',
      text: 'Lanzamos, te capacitamos y quedamos disponibles para acompañarte.',
    },
  ],
  contact: {
    eyebrow: 'Hablemos',
    title: 'Cuéntanos qué necesitas y',
    accent: 'lo hacemos realidad',
    description:
      'Escríbenos por WhatsApp o completa el formulario. Te respondemos con una orientación clara y los siguientes pasos.',
    whatsapp: '573222326038',
    whatsappLabel: '+57 322 232 6038',
    email: 'chsistem01@gmail.com',
  },
  footer: {
    description:
      'Sitios web para negocios que quieren dar el siguiente paso.',
  },
};

export function withSiteContentDefaults(content) {
  const base = JSON.parse(JSON.stringify(DEFAULT_SITE_CONTENT));

  if (!content || typeof content !== 'object') {
    return base;
  }

  return {
    ...base,
    ...content,
    hero: {
      ...base.hero,
      ...(content.hero || {}),
      points: Array.isArray(content.hero?.points)
        ? content.hero.points
        : base.hero.points,
    },
    services: { ...base.services, ...(content.services || {}) },
    benefits: Array.isArray(content.benefits)
      ? content.benefits
      : base.benefits,
    catalog: { ...base.catalog, ...(content.catalog || {}) },
    plans: { ...base.plans, ...(content.plans || {}) },
    planItems: Array.isArray(content.planItems)
      ? content.planItems
      : base.planItems,
    process: { ...base.process, ...(content.process || {}) },
    steps: Array.isArray(content.steps) ? content.steps : base.steps,
    contact: { ...base.contact, ...(content.contact || {}) },
    footer: { ...base.footer, ...(content.footer || {}) },
  };
}
