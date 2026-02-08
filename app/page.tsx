import Image from 'next/image'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="max-w-4xl w-full space-y-8 text-center">
        {/* Profile Image with multiple fallback approaches */}
        <div className="flex justify-center mb-8">
          <div className="relative w-48 h-48 rounded-full overflow-hidden border-4 border-border shadow-xl">
            <Image
              src="/profile.jpg"
              alt="Yerassul's Profile"
              fill
              className="object-cover"
              priority
              sizes="(max-width: 768px) 192px, 192px"
              onError={(e) => {
                console.log("[v0] Image loading error, attempting fallback")
                const target = e.target as HTMLImageElement
                target.style.display = 'none'
              }}
            />
            {/* CSS fallback background image */}
            <div 
              className="absolute inset-0 bg-muted"
              style={{
                backgroundImage: 'url(/profile.jpg)',
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}
            />
          </div>
        </div>
        
        <h1 className="text-6xl font-bold tracking-tight">
          Yerassul's Portfolio
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Welcome to my portfolio. This is the starting point for showcasing my work and projects.
        </p>
      </div>
    </main>
  )
}
