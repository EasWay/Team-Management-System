import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Zap } from "lucide-react";

export default function TermsOfService() {
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
            Terms of Service
          </h1>
          <p className="text-sm text-muted-foreground uppercase tracking-widest">
            Last updated: March 28, 2026
          </p>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-white">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By accessing or using TeamManager System ("the Service"), you agree to be bound by
              these Terms of Service ("Terms"). If you do not agree to these Terms, you may not
              access or use the Service. These Terms constitute a legally binding agreement between
              you and TeamManager System.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-white">2. Description of Service</h2>
            <p className="text-muted-foreground leading-relaxed">
              TeamManager System is a team management platform that provides tools for project
              management, team collaboration, task tracking, real-time messaging, repository
              integration, and organizational management. The Service is provided "as is" and may
              be updated, modified, or discontinued at any time.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-white">3. User Accounts</h2>
            <p className="text-muted-foreground leading-relaxed">
              To use certain features of the Service, you must create an account. You agree to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Provide accurate and complete registration information</li>
              <li>Maintain the security of your account credentials</li>
              <li>Notify us immediately of any unauthorized access to your account</li>
              <li>Accept responsibility for all activities that occur under your account</li>
              <li>Not share your account with others or allow others to use your account</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-white">4. Authentication</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Service supports authentication through third-party providers, including GitHub
              OAuth. By using third-party authentication, you authorize us to access certain
              information from your third-party account as described in our Privacy Policy. You may
              revoke this access at any time through your third-party account settings.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-white">5. Acceptable Use</h2>
            <p className="text-muted-foreground leading-relaxed">
              You agree not to use the Service to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Violate any applicable laws or regulations</li>
              <li>Infringe upon the rights of others</li>
              <li>Transmit malicious code, viruses, or harmful content</li>
              <li>Attempt to gain unauthorized access to the Service or other users' accounts</li>
              <li>Use the Service for spam, harassment, or abusive purposes</li>
              <li>Interfere with or disrupt the Service or its infrastructure</li>
              <li>Reverse engineer, decompile, or disassemble any part of the Service</li>
              <li>Use automated tools to access the Service without authorization</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-white">6. User Content</h2>
            <p className="text-muted-foreground leading-relaxed">
              You retain ownership of any content you submit, post, or display on or through the
              Service ("User Content"). By submitting User Content, you grant us a worldwide,
              non-exclusive, royalty-free license to use, copy, modify, and distribute your User
              Content solely for the purpose of providing and improving the Service.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              You are solely responsible for your User Content and represent that you have all
              necessary rights to grant us the license described above.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-white">7. Intellectual Property</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Service and its original content, features, and functionality are owned by
              TeamManager System and are protected by international copyright, trademark, patent,
              trade secret, and other intellectual property laws. You may not copy, modify,
              distribute, sell, or lease any part of the Service without our prior written consent.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-white">8. Third-Party Services</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Service integrates with third-party services including GitHub, cloud
              infrastructure providers, and AI services. Your use of these third-party services is
              subject to their respective terms and conditions. We are not responsible for the
              availability, accuracy, or content of third-party services.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-white">9. Data and Privacy</h2>
            <p className="text-muted-foreground leading-relaxed">
              Your use of the Service is also governed by our Privacy Policy. By using the Service,
              you consent to the collection and use of information as described in the Privacy
              Policy. Please review our Privacy Policy at{" "}
              <a href="/privacy" className="text-blue-400 hover:underline">/privacy</a>.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-white">10. Service Availability</h2>
            <p className="text-muted-foreground leading-relaxed">
              We strive to maintain high availability but do not guarantee uninterrupted access to
              the Service. The Service may be temporarily unavailable due to maintenance, updates,
              or circumstances beyond our control. We reserve the right to modify, suspend, or
              discontinue the Service at any time without prior notice.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-white">11. Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              To the maximum extent permitted by law, TeamManager System shall not be liable for
              any indirect, incidental, special, consequential, or punitive damages, including but
              not limited to loss of profits, data, use, or goodwill, arising from your use of the
              Service. Our total liability shall not exceed the amount you paid for the Service in
              the twelve months preceding the claim.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-white">12. Indemnification</h2>
            <p className="text-muted-foreground leading-relaxed">
              You agree to indemnify, defend, and hold harmless TeamManager System and its
              officers, directors, employees, and agents from any claims, damages, losses, or
              expenses (including reasonable attorneys' fees) arising from your use of the Service,
              your User Content, or your violation of these Terms.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-white">13. Termination</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may terminate or suspend your account and access to the Service at our sole
              discretion, without prior notice, for conduct that we believe violates these Terms or
              is harmful to the Service, other users, or third parties. Upon termination, your
              right to use the Service will immediately cease.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-white">14. Changes to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              We reserve the right to modify these Terms at any time. We will notify you of
              material changes by posting the updated Terms on this page and updating the "Last
              updated" date. Your continued use of the Service after changes constitutes acceptance
              of the revised Terms.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-white">15. Governing Law</h2>
            <p className="text-muted-foreground leading-relaxed">
              These Terms shall be governed by and construed in accordance with applicable laws,
              without regard to conflict of law principles. Any disputes arising from these Terms
              or your use of the Service shall be resolved through binding arbitration.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-white">16. Severability</h2>
            <p className="text-muted-foreground leading-relaxed">
              If any provision of these Terms is found to be unenforceable or invalid, that
              provision shall be limited or eliminated to the minimum extent necessary so that these
              Terms shall otherwise remain in full force and effect.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-bold text-white">17. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have any questions about these Terms of Service, please contact us:
            </p>
            <div className="liquid-glass p-6 rounded-2xl border border-white/5">
              <p className="text-white font-bold">TeamManager System</p>
              <p className="text-muted-foreground">Email: legal@teammanager.system</p>
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
            <a href="/terms" className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase hover:text-white transition-colors">
              Terms of Service
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
