import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAIChat } from '../context/AIChatContext'
import { SparkleIcon } from './AIChatWidget'

// Images live in public/banners — served directly
const slides = [
  {
    id: 1,
    image: '/banners/Big Sale Banner.png',
    url: '/?ct=electronics',
    overlay: null,
  },
  {
    id: 2,
    image: '/banners/New Arrivals.png',
    url: '/?sort=newest',
    overlay: null,
  },
  {
    id: 3,
    image: '/banners/Category Showcase.png',
    url: '/?ct=fashion',
    overlay: {
      badge: 'Curated Collection',
      heading: 'Elevate Your Everyday',
      subtext: 'Comfort meets modern style — explore new lifestyle picks',
      cta: 'Shop Lifestyle',
      aiPrompt: 'Show me the best fashion and lifestyle products',
      textColor: 'text-slate-900',
    },
  },
  {
    id: 4,
    image: '/banners/Festive_Discount Sale.png',
    url: '/?deals=true',
    overlay: {
      badge: 'Limited Time Deals',
      heading: 'Festive Sale is Here',
      subtext: 'Top-rated picks and everyday essentials at special prices',
      cta: 'Explore Deals',
      aiPrompt: 'Find the best value deals under ₹2000 right now',
      textColor: 'text-white',
    },
  },
]

export default function BannerCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const navigate = useNavigate()
  const { askAI } = useAIChat()

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % slides.length)
    }, 5500)
    return () => clearInterval(timer)
  }, [])

  const goToSlide = (index) => setCurrentIndex(index)
  const nextSlide = () => setCurrentIndex((prev) => (prev + 1) % slides.length)
  const prevSlide = () => setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length)

  return (
    <section className="max-w-[1440px] mx-auto w-full px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
      <div className="relative w-full aspect-[16/8] sm:aspect-[16/6] md:aspect-[3.2/1] lg:h-[420px] xl:h-[460px] rounded-2xl sm:rounded-3xl overflow-hidden bg-slate-900 shadow-md border border-slate-200/80 group select-none">
        {/* Slides Track */}
        <div
          className="flex h-full w-full transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {slides.map((slide, idx) => (
            <div
              key={slide.id}
              className="relative w-full h-full shrink-0 cursor-pointer"
              onClick={() => navigate(slide.url)}
            >
              <img
                src={slide.image}
                alt={slide.overlay?.heading ?? `Featured Promotion ${slide.id}`}
                fetchPriority={idx === 0 ? 'high' : 'low'}
                loading={idx === 0 ? 'eager' : 'lazy'}
                className="w-full h-full object-cover object-center"
              />

              {slide.overlay && (
                <div className="absolute inset-y-0 left-0 w-[70%] sm:w-[58%] md:w-[48%] flex flex-col justify-center px-5 sm:px-12 md:px-16 pointer-events-none">
                  <div className="pointer-events-auto max-w-lg z-10">
                    {slide.overlay.badge && (
                      <span
                        className={[
                          'inline-block px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-2 sm:mb-3',
                          slide.overlay.textColor === 'text-white'
                            ? 'bg-white/20 text-white backdrop-blur-xs border border-white/30'
                            : 'bg-slate-900/10 text-slate-900 border border-slate-900/15',
                        ].join(' ')}
                      >
                        {slide.overlay.badge}
                      </span>
                    )}
                    <h2
                      className={`text-lg sm:text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight mb-1 sm:mb-3 ${slide.overlay.textColor}`}
                    >
                      {slide.overlay.heading}
                    </h2>
                    <p
                      className={`text-xs sm:text-base md:text-lg mb-3 sm:mb-6 font-medium ${slide.overlay.textColor} opacity-90 line-clamp-2`}
                    >
                      {slide.overlay.subtext}
                    </p>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(slide.url)
                        }}
                        className={[
                          'px-4 py-2 sm:px-6 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md active:scale-95 cursor-pointer',
                          slide.overlay.textColor === 'text-white'
                            ? 'bg-white text-slate-900 hover:bg-slate-100'
                            : 'bg-slate-900 text-white hover:bg-slate-800',
                        ].join(' ')}
                      >
                        {slide.overlay.cta} →
                      </button>
                      {slide.overlay.aiPrompt && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            askAI(slide.overlay.aiPrompt)
                          }}
                          className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-indigo-600/95 hover:bg-indigo-600 text-white shadow-md backdrop-blur-xs transition-all cursor-pointer"
                        >
                          <SparkleIcon className="w-4 h-4 text-amber-300" />
                          <span>Ask AI</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Navigation Arrows */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            prevSlide()
          }}
          className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 hover:bg-white text-slate-900 backdrop-blur-xs rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-all z-10 cursor-pointer"
          aria-label="Previous slide"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>

        <button
          onClick={(e) => {
            e.stopPropagation()
            nextSlide()
          }}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 hover:bg-white text-slate-900 backdrop-blur-xs rounded-full flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-all z-10 cursor-pointer"
          aria-label="Next slide"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>

        {/* Slide Indicators */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10 bg-slate-950/35 backdrop-blur-xs px-3 py-1.5 rounded-full">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.stopPropagation()
                goToSlide(index)
              }}
              className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                currentIndex === index ? 'bg-white w-7 shadow-2xs' : 'bg-white/50 hover:bg-white/80 w-2'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
