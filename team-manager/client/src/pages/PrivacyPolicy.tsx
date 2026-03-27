import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Zap } from "lucide-react";

export default function PrivacyPolicy() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#0A0A0B] font-sans selection:bg-primary/20 text-white">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>

      {/* Navigation */}
      <nav className="relative z-50 container mx-auto px-6 py-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-9 bg-white rounded-lg flex items-center justify-center">
            <Zap className="text-black size-6 fill-current" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white uppercase italic">TeamMgr</span>
        </div>
        <Button
          variant="outline"
          className="bg-black text-white hover:bg-black/90 border-white/20 rounded-full px-8 h-10 text-xs font-bold shadow-[0_0_20px_rgba(255,255,255,0.1)] transition-all hover:scale-[1.02]"
          onClick={() => setLocation("/")}
        >
          <ArrowLeft className="mr-2 size-4" /> Back to Home
        </Button>
      </nav>

      <main className="relative z-10 container mx-auto px-6 py-12 max-w-3xl">
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tighter text-white">
            Privacy Policy
          </h1>
          <p className="text-sm text-muted-foreground uppercase tracking-widest">
            Last updated: March 27, 2026
          </p>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-white">1. Introduction</h2>
            <p className="text-muted-foreground leading-relaxed">
              Welcome to TeamManager System ("we," "our," or "us"). We are committed to protecting
              your personal information and your right to privacy. This Privacy Policy explains how
              we collect, use, disclose, and safeguard your information when you use our team
              management platform.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-white">2. Information We Collect</h2>
            <p className="text-muted-foreground leading-relaxed">
              We collect information that you provide directly to us, including:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li><strong className="text-white">Account Information:</strong> Name, email address, and profile details when you create an account or sign in via GitHub OAuth.</li>
              <li><strong className="text-white">Team Data:</strong> Information about your teams, projects, tasks, and organizational structure.</li>
              <li><strong className="text-white">Communications:</strong> Messages, comments, and other content you share within the platform.</li>
              <li><strong className="text-white">Usage Data:</strong> How you interact with our platform, including features used and time spent.</li>
              <li><strong className="text-white">Device Information:</strong> Browser type, operating system, IP address, and device identifiers.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-white">3. How We Use Your Information</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use the information we collect to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Provide, maintain, and improve our services</li>
              <li>Authenticate your identity and manage your account</li>
              <li>Enable team collaboration features and real-time communication</li>
              <li>Send you technical notices, updates, and support messages</li>
              <li>Monitor and analyze usage patterns to improve user experience</li>
              <li>Detect, prevent, and address technical issues and security threats</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-white">4. Data Storage and Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              Your data is stored securely using industry-standard practices:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>All data is encrypted in transit using TLS/SSL</li>
              <li>Sensitive data such as OAuth tokens are encrypted at rest</li>
              <li>Passwords are hashed using bcrypt before storage</li>
              <li>We use secure database hosting with regular backups</li>
              <li>Access to your data is restricted to authorized personnel only</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-white">5. Third-Party Services</h2>
            <p className="text-muted-foreground leading-relaxed">
              We integrate with the following third-party services:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li><strong className="text-white">GitHub:</strong> For OAuth authentication and repository integration. We access only the permissions you grant during sign-in.</li>
              <li><strong className="text-white">Cloud Infrastructure:</strong> Our services are hosted on secure cloud platforms with industry-standard security certifications.</li>
              <li><strong className="text-white">AI Services:</strong> We may use AI models for features like task suggestions and code analysis. Your data is processed according to the AI provider's privacy terms.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-white">6. Data Sharing</h2>
            <p className="text-muted-foreground leading-relaxed">
              We do not sell your personal information. We may share your data only in the following circumstances:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>With your team members as part of the collaboration features</li>
              <li>With service providers who assist in operating our platform</li>
              <li>When required by law or to protect our legal rights</li>
              <li>In connection with a merger, acquisition, or sale of assets</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-white">7. Your Rights</h2>
            <p className="text-muted-foreground leading-relaxed">
              You have the right to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Access and download your personal data</li>
              <li>Correct inaccurate or incomplete information</li>
              <li>Request deletion of your account and data</li>
              <li>Opt out of non-essential communications</li>
              <li>Revoke GitHub OAuth access at any time through your GitHub settings</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-white">8. Data Retention</h2>
            <p className="text-muted-foreground leading-relaxed">
              We retain your information for as long as your account is active or as needed to
              provide you services. If you delete your account, we will delete your personal data
              within 30 days, except where we are required to retain it for legal, regulatory, or
              legitimate business purposes.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-white">9. Children's Privacy</h2>
            <p className="text-muted-foreground leading-relaxed">
              Our service is not intended for individuals under the age of 16. We do not knowingly
              collect personal information from children under 16. If we become aware that we have
              collected personal data from a child under 16, we will take steps to delete that
              information.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-white">10. Changes to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any changes
              by posting the new Privacy Policy on this page and updating the "Last updated" date.
              You are advised to review this Privacy Policy periodically for any changes.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-white">11. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have any questions about this Privacy Policy or our data practices, please
              contact us:
            </p>
            <div className="liquid-glass p-6 rounded-2xl border border-white/5">
              <p className="text-white font-bold">TeamManager System</p>
              <p className="text-muted-foreground">Email: privacy@teammanager.system</p>
              <p className="text-muted-foreground">GitHub: <a href="https://github.com/EasWay/Team-Management-System" className="text-blue-400 hover:underline">EasWay/Team-Management-System</a></p>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-12 mt-12 border-t border-white/5">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase opacity-40">
            &copy; 2026 TeamManager System. All rights reserved.
          </div>
          <div className="flex gap-6">
            <a href="/privacy" className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase hover:text-white transition-colors">
              Privacy Policy
            </a>
            <a href="/" className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase hover:text-white transition-colors">
              Home
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
