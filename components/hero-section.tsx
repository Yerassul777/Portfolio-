"use client"

import { ArrowDown, Sparkles, Target, Users, BookOpen } from "lucide-react"
import { Button } from "@/components/ui/button"

export function HeroSection() {
  const scrollToContent = () => {
    const element = document.getElementById('opportunities')
    element?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <>
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-green-50 pt-16">
        {/* Animated gradient background */}
        <div className="absolute inset-0">
          {/* Animated glow effects */}
          <div className="absolute top-1/4 right-1/4 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] bg-emerald-600/3 rounded-full blur-[100px] animate-pulse [animation-delay:1.5s]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-400/3 rounded-full blur-[150px] animate-pulse [animation-delay:0.75s]" />
          
          {/* Grid pattern overlay */}
          <div 
            className="absolute inset-0 opacity-[0.02]"
            style={{
              backgroundImage: `linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px)`,
              backgroundSize: '60px 60px'
            }}
          />
        </div>

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-5xl mx-auto text-center space-y-10">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-700">
              <span className="text-sm text-emerald-300 font-medium">Платформа для молодёжи Казахстана</span>
            </div>

            {/* Main heading */}
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-1000 [animation-delay:100ms]">
              <h1 className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-bold tracking-tight">
                <span className="text-foreground">Найди свою</span>
                <br />
                <span className="bg-gradient-to-r from-emerald-600 via-green-600 to-emerald-700 bg-clip-text text-transparent">
                  возможность
                </span>
              </h1>
              <p className="text-lg sm:text-xl lg:text-2xl text-muted-foreground max-w-3xl mx-auto text-balance leading-relaxed">
                Олимпиады, соревнования, волонтёрство и лучшие университеты Казахстана — всё в одном месте для построения твоего успешного будущего
              </p>
            </div>

            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-in fade-in slide-in-from-bottom-8 duration-1000 [animation-delay:200ms]">
              <Button 
                size="lg" 
                onClick={scrollToContent}
                className="text-base px-8 py-6 rounded-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all duration-300 hover:scale-105 border-0"
              >
                Начать поиск
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                onClick={scrollToContent}
                className="text-base px-8 py-6 rounded-full transition-all duration-300 hover:scale-105"
              >
                Узнать больше
              </Button>
            </div>

            {/* Stats */}
            
          </div>
        </div>

        {/* Scroll indicator */}
        <button
          onClick={scrollToContent}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 cursor-pointer group"
          aria-label="Scroll to content"
        >
          
        </button>
      </section>
    </>
  )
}
