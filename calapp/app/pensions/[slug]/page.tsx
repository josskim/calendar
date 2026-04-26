import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

interface PensionPageProps {
  params: Promise<{ slug: string }>;
}

export default async function PensionPage({ params }: PensionPageProps) {
  const { slug } = await params;

  // DB에서 해당 슬러그 또는 도메인과 일치하는 펜션 조회
  const pension = await prisma.pension.findFirst({
    where: {
      OR: [
        { slug: slug },
        { customDomain: slug }
      ]
    },
    include: {
      rooms: {
        include: {
          images: true
        }
      }
    }
  });

  if (!pension) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: 'var(--font-sans)', color: '#333' }}>
      <header className="fixed top-0 w-full bg-white/80 backdrop-blur-md z-50 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">{pension.name}</h1>
          <nav className="hidden md:flex space-x-8 text-sm font-medium">
            <a href="#about" className="hover:text-primary transition-colors">소개</a>
            <a href="#rooms" className="hover:text-primary transition-colors">객실안내</a>
            <a href="#reservation" className="hover:text-primary transition-colors">실시간예약</a>
          </nav>
        </div>
      </header>

      <main className="pt-20">
        {/* 히어로 섹션 */}
        <section className="relative h-[80vh] flex items-center justify-center bg-gray-50 overflow-hidden">
          <div className="text-center z-10 px-4">
            <h2 className="text-5xl md:text-7xl font-extrabold mb-6 tracking-tight text-gray-900 leading-tight">
              {pension.name}<br/>
              <span className="text-gray-400">당신만의 특별한 휴식</span>
            </h2>
            <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
              도심을 벗어나 자연과 함께하는 진정한 쉼을 경험해보세요.
            </p>
          </div>
        </section>

        {/* 객실 섹션 */}
        <section id="rooms" className="py-24 px-4 bg-gray-50">
          <div className="max-w-7xl mx-auto">
            <h3 className="text-3xl font-bold mb-12 text-center text-gray-900">OUR ROOMS</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {pension.rooms.map((room) => (
                <div key={room.id} className="group bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300">
                  <div className="aspect-[4/3] bg-gray-200 relative overflow-hidden">
                    {room.images[0] ? (
                      <img src={room.images[0].url} alt={room.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">이미지 준비 중</div>
                    )}
                  </div>
                  <div className="p-8">
                    <h4 className="text-2xl font-bold mb-2 group-hover:text-primary transition-colors">{room.name}</h4>
                    <p className="text-gray-500 mb-6 line-clamp-2 leading-relaxed">{room.description}</p>
                    <div className="flex justify-between items-center pt-4 border-t border-gray-50">
                      <span className="text-lg font-bold text-gray-900">₩{room.basePrice.toLocaleString()}~</span>
                      <button className="px-6 py-2.5 bg-black text-white text-sm font-bold rounded-full hover:bg-gray-800 transition-all">
                        자세히 보기
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-white border-t border-gray-100 py-16 px-4">
        <div className="max-w-7xl mx-auto text-center text-gray-400 text-sm">
          <p>© 2026 {pension.name}. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
