export default function Footer() {
  return (
    <footer className="bg-blue-900 text-white mt-20">
      <div className="max-w-7xl mx-auto px-6 py-12 grid md:grid-cols-4 gap-8">

        <div>
          <h2 className="text-2xl font-bold">AllJobsIndia</h2>
          <p className="mt-4 text-gray-300">
            India's trusted portal for Government Jobs,
            Private Jobs, Results, Admit Cards and Career Updates.
          </p>
        </div>

        <div>
          <h3 className="font-bold text-lg mb-3">Quick Links</h3>
          <ul className="space-y-2 text-gray-300">
            <li>Home</li>
            <li>Government Jobs</li>
            <li>Private Jobs</li>
            <li>Results</li>
          </ul>
        </div>

        <div>
          <h3 className="font-bold text-lg mb-3">Resources</h3>
          <ul className="space-y-2 text-gray-300">
            <li>Admit Card</li>
            <li>Answer Key</li>
            <li>Latest Notifications</li>
            <li>Contact Us</li>
          </ul>
        </div>

        <div>
          <h3 className="font-bold text-lg mb-3">Follow Us</h3>
          <p className="text-gray-300">
            Facebook<br />
            Telegram<br />
            YouTube<br />
            WhatsApp
          </p>
        </div>

      </div>

      <div className="border-t border-blue-800 py-4 text-center text-gray-300">
        © 2026 AllJobsIndia. All Rights Reserved.
      </div>
    </footer>
  );
}