import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

import bigSaleBanner from '../assets/banner/Big Sale Banner.png'
import newArrivals from '../assets/banner/New Arrivals.png'
import categoryShowcase from '../assets/banner/Category Showcase.png'
import festiveDiscount from '../assets/banner/Festive_Discount Sale.png'

const slides = [
  {
    id: 1,
    image: bigSaleBanner,
    url: '/?ct=electronics',
    overlay: null,
  },
  {
    id: 2,
    image: newArrivals,
    url: '/?sort=newest',
    overlay: null,
  },
  {
    id: 3,
    image: categoryShowcase,
    url: '/?ct=fashion',
    overlay: {
      heading: 'Elevate Your Everyday',
      subtext: 'Comfort meets style — new lifestyle picks',
      cta: 'Shop Lifestyle',
      textColor: 'text-gray-800',
    },
  },
  {
    id: 4,
    image: festiveDiscount,
    url: '/?deals=true',
    overlay: {
      heading: 'Festive Sale is Here',
      subtext: 'Flat 50% Off on Top Categories',
      cta: 'Grab the Deal',
      textColor: 'text-white',
    },
  },
]

export default function BannerCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const navigate = useNavigate()

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % slides.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [])

  const goToSlide = (index) => {
    setCurrentIndex(index)
  }

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % slides.length)
  }

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length)
  }

  return (
    <div className="relative w-full h-[300px] sm:h-[400px] lg:h-[550px] xl:h-[600px] overflow-hidden bg-gray-100 group select-none">
      {/* Slides Container */}
      <div
        className="flex h-full w-full transition-transform duration-500 ease-in-out"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
      >
        {slides.map((slide) => (
          <div
            key={slide.id}
            className="relative w-full h-full flex-shrink-0 cursor-pointer"
            onClick={() => navigate(slide.url)}
          >
            {/* Background Image */}
            <img
              src={slide.image}
              alt={`Banner ${slide.id}`}
              className="w-full h-full object-cover object-center"
            />
            
            {/* Text Overlay */}
            {slide.overlay && (
              <div className="absolute inset-y-0 left-0 w-full sm:w-[55%] md:w-[45%] flex flex-col justify-center px-6 sm:px-12 md:px-16 pointer-events-none bg-black/20 sm:bg-transparent">
                <div className="pointer-events-auto max-w-lg z-10">
                  <h2 className={`text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold mb-2 md:mb-4 ${slide.overlay.textColor} drop-shadow-md sm:drop-shadow-none`}>
                    {slide.overlay.heading}
                  </h2>
                  <p className={`text-sm sm:text-base md:text-lg lg:text-xl mb-4 md:mb-6 font-medium ${slide.overlay.textColor} opacity-95 drop-shadow-md sm:drop-shadow-none`}>
                    {slide.overlay.subtext}
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(slide.url)
                    }}
                    className={`px-5 py-2 md:px-8 md:py-3 rounded-full text-sm md:text-base font-bold transition-all shadow-md active:scale-95 ${
                      slide.overlay.textColor === 'text-white' 
                        ? 'bg-white text-gray-900 hover:bg-gray-100 hover:shadow-lg' 
                        : 'bg-gray-900 text-white hover:bg-gray-800 hover:shadow-lg'
                    }`}
                  >
                    {slide.overlay.cta}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Navigation Arrows */}
      <button
        onClick={(e) => { e.stopPropagation(); prevSlide() }}
        className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/60 hover:bg-white text-gray-800 rounded-full flex items-center justify-center shadow hover:shadow-md opacity-0 group-hover:opacity-100 transition-all z-10"
        aria-label="Previous slide"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
      </button>

      <button
        onClick={(e) => { e.stopPropagation(); nextSlide() }}
        className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/60 hover:bg-white text-gray-800 rounded-full flex items-center justify-center shadow hover:shadow-md opacity-0 group-hover:opacity-100 transition-all z-10"
        aria-label="Next slide"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </button>

      {/* Dots */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={(e) => { e.stopPropagation(); goToSlide(index) }}
            className={`h-2.5 rounded-full transition-all duration-300 ${
              currentIndex === index ? 'bg-white w-8 shadow-sm' : 'bg-white/50 hover:bg-white/80 w-2.5'
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  )
}
