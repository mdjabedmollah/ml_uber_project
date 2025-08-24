import { RideRequestCard } from "@/components/ride-request-card"
import { MapPin } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen items-center justify-center bg-gray-100 p-4">
      <main className="flex flex-col items-center justify-center w-full max-w-4xl gap-8">
        <RideRequestCard />
        {/* Placeholder for a map or other visual elements */}
        <div className="w-full h-80 bg-gray-200 rounded-lg flex items-center justify-center text-gray-500 text-lg border border-dashed border-gray-400">
          <MapPin className="w-6 h-6 mr-2" />
          {'Map Placeholder (e.g., Google Maps, OpenStreetMap)'}
        </div>
      </main>
    </div>
  )
}
