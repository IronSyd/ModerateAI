import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { motion, useReducedMotion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  MessagesSquare, 
  CheckCircle, 
  Shield, 
  Sparkles, 
  ArrowRight, 
  Globe
} from "lucide-react";
import { SiDiscord, SiTelegram } from "react-icons/si";
import { Logo } from "@/components/logo";
import { AtmosphereOrbs } from "@/components/atmosphere-orbs";
import { getSupportTelegramUrl } from "@/lib/support";

const LandingPage = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isYearly, setIsYearly] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const { user, isLoading: isAuthLoading } = useAuth();
  const supportUrl = getSupportTelegramUrl();
  const [supportDialogOpen, setSupportDialogOpen] = useState(false);

  const onContactSupport = () => {
    if (isAuthLoading) return;

    if (user) {
      window.open(supportUrl, "_blank", "noopener,noreferrer");
      return;
    }

    setSupportDialogOpen(true);
  };

  const fadeInUp = {
    initial: shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.25 },
    transition: { duration: 0.45, ease: "easeOut" as const },
  };

  return (
    <div className="landing-kinetic min-h-screen bg-background text-foreground relative overflow-x-clip">
      <Dialog open={supportDialogOpen} onOpenChange={setSupportDialogOpen}>
        <DialogContent className="glass-surface sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Create an account first</DialogTitle>
            <DialogDescription>
              To contact support, you&apos;ll need a ModerateAI account.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" className="glass-chip" onClick={() => setSupportDialogOpen(false)}>
              Cancel
            </Button>
            <Link href="/auth?mode=signup">
              <Button type="button" className="tactile-button" onClick={() => setSupportDialogOpen(false)}>
                Create account
              </Button>
            </Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <motion.header
        className="fixed top-0 left-0 right-0 z-50 py-4 px-6 md:px-8 border-b border-border bg-background/80 backdrop-blur-md"
        initial={shouldReduceMotion ? false : { opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      >
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          {/* Logo */}
          <Logo />

          {/* Navigation - Desktop */}
          <nav className="hidden md:flex items-center space-x-8">
            <a
              href="#features"
              className="tactile-button glass-chip rounded-md px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              Features
            </a>
            <a
              href="#pricing"
              className="tactile-button glass-chip rounded-md px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              Pricing
            </a>
            <a
              href="#integrations"
              className="tactile-button glass-chip rounded-md px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              Integrations
            </a>
            <Link href="/dashboard">
              <Button variant="default" className="tactile-button">Go to Dashboard</Button>
            </Link>
          </nav>

          {/* Mobile Menu Button */}
          <button 
            className="md:hidden text-muted-foreground hover:text-foreground"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <motion.div
            className="md:hidden py-4 px-6 mt-2 bg-card rounded-lg shadow-md"
            initial={shouldReduceMotion ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <nav className="flex flex-col space-y-4">
              <a 
                href="#features" 
                className="tactile-button glass-chip rounded-md px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Features
              </a>
              <a 
                href="#pricing" 
                className="tactile-button glass-chip rounded-md px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Pricing
              </a>
              <a 
                href="#integrations" 
                className="tactile-button glass-chip rounded-md px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Integrations
              </a>
              <Link href="/dashboard">
                <Button variant="default" className="w-full tactile-button">Go to Dashboard</Button>
              </Link>
            </nav>
          </motion.div>
        )}
      </motion.header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 md:px-8 relative">
        <AtmosphereOrbs className="z-0" />
        <div className="relative z-10 max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: "easeOut" }}
            >
              <h1 className="kinetic-headline text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
                AI-Powered 
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-600 ml-2">
                  Customer Support
                </span>
              </h1>
              <p className="text-xl text-muted-foreground mb-8">
                Deliver instant support and capture qualified leads from your website, Telegram, and Discord in one workspace.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/dashboard">
                  <Button size="lg" className="w-full sm:w-auto tactile-button">
                    Get Started 
                    <ArrowRight className="ml-2 h-5 w-5 tactile-icon" />
                  </Button>
                </Link>
                <a href="#features">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto glass-chip tactile-button">
                    Learn More
                  </Button>
                </a>
              </div>
            </motion.div>
            <motion.div
              className="hidden md:block rounded-xl shadow-lg p-8 surface-glow lift-card glass-surface"
              initial={shouldReduceMotion ? false : { opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.55, ease: "easeOut", delay: 0.08 }}
            >
              <div className="space-y-4">
                <div className="rounded-md p-4 glass-chip">
                  <h3 className="kinetic-headline font-medium mb-2">Welcome to ModerateAI!</h3>
                  <p className="text-muted-foreground text-sm">
                    I'm your AI assistant. I can help detect inappropriate content and provide customer support across all your platforms.
                  </p>
                </div>
                <div className="rounded-md p-4 flex items-start glass-chip">
                  <div className="mr-3 mt-1">
                    <div className="h-8 w-8 rounded-full bg-primary/20 border border-white/10 flex items-center justify-center">
                      <MessagesSquare className="h-4 w-4 text-primary" />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm">
                      How does ModerateAI handle content moderation across different platforms?
                    </p>
                  </div>
                </div>
                <div className="rounded-md p-4 flex items-start glass-chip">
                  <div className="mr-3 mt-1">
                    <div className="h-8 w-8 rounded-full bg-primary border border-white/10 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary-foreground" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm">
                      ModerateAI uses advanced AI models to offer customer support and moderation across your website, Discord, and Telegram channels. Our platform provides consistent moderation with customizable strictness levels to match your community guidelines.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="scroll-mt-28 py-20 px-6 md:px-8 bg-accent/30">
        <div className="max-w-7xl mx-auto">
          <motion.div className="text-center mb-16" {...fadeInUp}>
            <h2 className="kinetic-headline text-3xl md:text-4xl font-bold mb-4">Powerful Features</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Everything you need to provide exceptional customer support and community moderation.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <motion.div className="bg-card border border-border rounded-xl p-6 shadow-sm surface-glow lift-card" {...fadeInUp}>
              <div className="rounded-full bg-primary/10 p-3 w-fit mb-4">
                <MessagesSquare className="h-6 w-6 text-primary" />
              </div>
              <h3 className="kinetic-headline text-xl font-semibold mb-2">Multi-platform Integration</h3>
              <p className="text-muted-foreground">
                Seamlessly connect your website, Telegram groups, and Discord servers to deliver consistent support and capture leads across every channel.
              </p>
            </motion.div>

            {/* Feature 2 */}
            <motion.div className="bg-card border border-border rounded-xl p-6 shadow-sm surface-glow lift-card" {...fadeInUp}>
              <div className="rounded-full bg-primary/10 p-3 w-fit mb-4">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="kinetic-headline text-xl font-semibold mb-2">Intelligent Moderation</h3>
              <p className="text-muted-foreground">
                Automatically detect and filter harmful or toxic content while enforcing your moderation policies to maintain a healthy community environment.
              </p>
            </motion.div>

            {/* Feature 3 */}
            <motion.div className="bg-card border border-border rounded-xl p-6 shadow-sm surface-glow lift-card" {...fadeInUp}>
              <div className="rounded-full bg-primary/10 p-3 w-fit mb-4">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <h3 className="kinetic-headline text-xl font-semibold mb-2">Custom AI Configuration</h3>
              <p className="text-muted-foreground">
                Fine-tune your AI assistant's responses with customizable tone, length, and knowledge base for personalized interactions.
              </p>
            </motion.div>

            {/* Feature 4 */}
            <motion.div className="bg-card border border-border rounded-xl p-6 shadow-sm surface-glow lift-card" {...fadeInUp}>
              <div className="rounded-full bg-primary/10 p-3 w-fit mb-4">
                <CheckCircle className="h-6 w-6 text-primary" />
              </div>
              <h3 className="kinetic-headline text-xl font-semibold mb-2">Knowledge Base Integration</h3>
              <p className="text-muted-foreground">
                Upload documents and FAQs to enable your AI assistant to provide accurate and contextual responses to user queries.
              </p>
            </motion.div>

            {/* Feature 5 */}
            <motion.div className="bg-card border border-border rounded-xl p-6 shadow-sm surface-glow lift-card" {...fadeInUp}>
              <div className="rounded-full bg-primary/10 p-3 w-fit mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="kinetic-headline text-xl font-semibold mb-2">Analytics & Insights</h3>
              <p className="text-muted-foreground">
                Track conversations, response rates, and moderation actions with comprehensive analytics to improve your support strategy.
              </p>
            </motion.div>

            {/* Feature 6 */}
            <motion.div className="bg-card border border-border rounded-xl p-6 shadow-sm surface-glow lift-card" {...fadeInUp}>
              <div className="rounded-full bg-primary/10 p-3 w-fit mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
              </div>
              <h3 className="kinetic-headline text-xl font-semibold mb-2">Customizable Templates</h3>
              <p className="text-muted-foreground">
                Create and save response templates for common queries to maintain consistency and save time in customer interactions.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Integrations Section */}
      <section id="integrations" className="scroll-mt-28 py-20 px-6 md:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div className="text-center mb-16" {...fadeInUp}>
            <h2 className="kinetic-headline text-3xl md:text-4xl font-bold mb-4">Seamless Integrations</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Connect with your favorite platforms for unified customer support and moderation.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Website Integration */}
            <motion.div className="rounded-xl p-8 shadow-sm text-center surface-glow lift-card glass-surface" {...fadeInUp}>
              <div className="rounded-full bg-primary/10 border border-white/10 p-4 w-20 h-20 mx-auto mb-6 flex items-center justify-center glass-chip">
                <Globe className="h-8 w-8 text-primary" />
              </div>
              <h3 className="kinetic-headline text-xl font-semibold mb-2">Website Widget + Lead Capture</h3>
              <p className="text-muted-foreground mb-6">
                Deploy an AI chat widget that supports visitors and converts high-intent conversations into leads.
              </p>
              <Link href="/integrations/website">
                <Button variant="outline" className="w-full glass-chip tactile-button">Launch Lead Widget</Button>
              </Link>
            </motion.div>

            {/* Telegram Integration */}
            <motion.div className="rounded-xl p-8 shadow-sm text-center surface-glow lift-card glass-surface" {...fadeInUp}>
              <div className="rounded-full bg-primary/10 border border-white/10 p-4 w-20 h-20 mx-auto mb-6 flex items-center justify-center glass-chip">
                <SiTelegram className="h-8 w-8 text-[#229ED9]" />
              </div>
              <h3 className="kinetic-headline text-xl font-semibold mb-2">Telegram Bot</h3>
              <p className="text-muted-foreground mb-6">
                Add an AI assistant to your Telegram groups to moderate content and answer user questions.
              </p>
              <Link href="/integrations/telegram">
                <Button variant="outline" className="w-full glass-chip tactile-button">Learn More</Button>
              </Link>
            </motion.div>

            {/* Discord Integration */}
            <motion.div className="rounded-xl p-8 shadow-sm text-center surface-glow lift-card glass-surface" {...fadeInUp}>
              <div className="rounded-full bg-primary/10 border border-white/10 p-4 w-20 h-20 mx-auto mb-6 flex items-center justify-center glass-chip">
                <SiDiscord className="h-8 w-8 text-[#5865F2]" />
              </div>
              <h3 className="kinetic-headline text-xl font-semibold mb-2">Discord Bot</h3>
              <p className="text-muted-foreground mb-6">
                Integrate with Discord to automate moderation and provide support in your server channels.
              </p>
              <Link href="/integrations/discord">
                <Button variant="outline" className="w-full glass-chip tactile-button">Learn More</Button>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="scroll-mt-28 py-20 px-6 md:px-8 bg-accent/30">
        <div className="max-w-7xl mx-auto">
          <motion.div className="text-center mb-16" {...fadeInUp}>
            <h2 className="kinetic-headline text-3xl md:text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
              Choose the plan that fits your needs. All plans include Telegram, Discord, and the web widget with lead capture (within plan limits). Standard and Pro are activated by support after payment.
            </p>

            {/* Billing Period Toggle */}
            <div className="mx-auto mb-8 flex w-fit items-center justify-center space-x-4 rounded-full px-5 py-3 glass-chip">
              <span className={`text-base font-medium ${!isYearly ? 'text-foreground' : 'text-muted-foreground'}`}>
                Monthly
              </span>
              <Switch 
                checked={isYearly} 
                onCheckedChange={setIsYearly}
                className="data-[state=checked]:bg-primary"
              />
              <span className="flex items-center">
                <span className={`text-base font-medium ${isYearly ? 'text-foreground' : 'text-muted-foreground'}`}>
                  Yearly
                </span>
                <span className="ml-2 text-green-400 text-xs font-medium rounded-full px-2 py-0.5 glass-chip border border-green-500/30">
                  Save 15%
                </span>
              </span>
            </div>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 items-start">
            {/* Free Plan */}
            <motion.div className="rounded-xl p-8 shadow-sm h-auto surface-glow lift-card glass-surface" {...fadeInUp}>
              <h3 className="kinetic-headline text-xl font-semibold mb-2">Free</h3>
              <div className="mb-4">
                <span className="text-4xl font-bold">$0</span>
                <span className="text-muted-foreground">/month</span>
                <div className="mt-1 text-sm text-green-600 font-medium">Free forever</div>
              </div>
              <p className="text-muted-foreground mb-6">
                Perfect for individuals validating early workflows.
              </p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center">
                  <CheckCircle className="pricing-icon" />
                  <span>20 AI responses/day (600/month)</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="pricing-icon" />
                  <span>Telegram, Discord, and web widget with lead capture</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="pricing-icon" />
                  <span>1 team seat</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="pricing-icon" />
                  <span>Basic moderation presets</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="pricing-icon" />
                  <span>7-day conversation history</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="pricing-icon" />
                  <span>10MB knowledge base storage</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="pricing-icon" />
                  <span>Community support (no SLA)</span>
                </li>
              </ul>
              <Link href="/auth?plan=free">
                <Button className="w-full glass-chip tactile-button" variant="outline">Get Started Free</Button>
              </Link>
            </motion.div>

            {/* Standard Plan */}
            <motion.div className="border-2 border-primary rounded-xl p-8 shadow-lg relative h-auto surface-glow lift-card glass-surface overflow-visible" {...fadeInUp}>
              <div className="absolute top-0 right-6 z-20 -translate-y-1/2 rounded-full bg-primary px-3 py-1 text-xs font-semibold tracking-wide text-primary-foreground shadow-lg ring-1 ring-primary/40">
                Most Popular
              </div>
              <h3 className="kinetic-headline text-xl font-semibold mb-2">Standard</h3>
              <div className="mb-4">
                <span className="text-4xl font-bold">{isYearly ? '$68' : '$80'}</span>
                <span className="text-muted-foreground">{isYearly ? '/month, billed annually' : '/month'}</span>
                <div className="mt-1 text-sm text-muted-foreground font-medium">Activation via support</div>
              </div>
              <p className="text-muted-foreground mb-6">
                Built for small teams and growing communities.
              </p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center">
                  <CheckCircle className="pricing-icon" />
                  <span>2,500 AI responses/day (75,000/month)</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="pricing-icon" />
                  <span>Telegram, Discord, and web widget with lead capture</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="pricing-icon" />
                  <span>Up to 5 team seats</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="pricing-icon" />
                  <span>Custom moderation rules</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="pricing-icon" />
                  <span>Sentiment analysis</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="pricing-icon" />
                  <span>90-day conversation history</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="pricing-icon" />
                  <span>250MB knowledge base storage</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="pricing-icon" />
                  <span>Standard analytics dashboard</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="pricing-icon" />
                  <span>Email support (first response within 24h)</span>
                </li>
              </ul>
              <Button
                type="button"
                className="w-full glass-chip tactile-button"
                disabled={isAuthLoading}
                onClick={onContactSupport}
              >
                Contact Support
              </Button>
            </motion.div>

            {/* Pro Plan */}
            <motion.div className="rounded-xl p-8 shadow-sm h-auto surface-glow lift-card glass-surface" {...fadeInUp}>
              <h3 className="kinetic-headline text-xl font-semibold mb-2">Pro</h3>
              <div className="mb-4">
                <span className="text-4xl font-bold">{isYearly ? '$127' : '$150'}</span>
                <span className="text-muted-foreground">{isYearly ? '/month, billed annually' : '/month'}</span>
                <div className="mt-1 text-sm text-muted-foreground font-medium">Activation via support</div>
              </div>
              <p className="text-muted-foreground mb-6">
                Best for high-volume teams running mission-critical support.
              </p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center">
                  <CheckCircle className="pricing-icon" />
                  <span>6,000 AI responses/day (180,000/month)</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="pricing-icon" />
                  <span>Telegram, Discord, and web widget with lead capture</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="pricing-icon" />
                  <span>Up to 20 team seats</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="pricing-icon" />
                  <span>Advanced moderation automation</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="pricing-icon" />
                  <span>Deep analytics, data export, and audit log</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="pricing-icon" />
                  <span>365-day conversation history</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="pricing-icon" />
                  <span>1,000MB knowledge base storage</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="pricing-icon" />
                  <span>24/7 priority support (first response within 2h)</span>
                </li>
              </ul>
              <Button
                type="button"
                className="w-full glass-chip tactile-button"
                disabled={isAuthLoading}
                onClick={onContactSupport}
              >
                Contact Support
              </Button>
            </motion.div>

          </div>
          <p className="text-xs text-muted-foreground text-center mt-6">
            Includes fair-use safeguards. Overage billed per 1,000 AI responses.
          </p>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 md:px-8">
        <motion.div className="max-w-5xl mx-auto text-center" {...fadeInUp}>
          <h2 className="kinetic-headline text-3xl md:text-4xl font-bold mb-6">Ready to transform your customer support?</h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            Join thousands of businesses using ModerateAI to provide excellent customer support and capture more qualified leads. Need Standard or Pro? Contact support for activation after payment.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link href="/auth?plan=free">
              <Button size="lg" variant="outline" className="tactile-button">
                Start Free Forever
                <ArrowRight className="ml-2 h-5 w-5 tactile-icon" />
              </Button>
            </Link>
            <Button
              type="button"
              size="lg"
              className="tactile-button"
              disabled={isAuthLoading}
              onClick={onContactSupport}
            >
              Contact Support
              <ArrowRight className="ml-2 h-5 w-5 tactile-icon" />
            </Button>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-12 px-6 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center mb-4">
                <div className="rounded-lg bg-primary p-2 mr-2">
                  <MessagesSquare className="h-6 w-6 text-primary-foreground" />
                </div>
                <span className="text-xl font-bold text-foreground">ModerateAI</span>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                AI-powered customer support and community moderation for all your platforms.
              </p>
            </div>

            <div>
              <h3 className="kinetic-headline font-semibold mb-4">Product</h3>
              <ul className="space-y-2">
                <li><a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</a></li>
                <li><a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</a></li>
                <li><a href="#integrations" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Integrations</a></li>
              </ul>
            </div>

            <div>
              <h3 className="kinetic-headline font-semibold mb-4">Resources</h3>
              <ul className="space-y-2">
                <li><a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Documentation</a></li>
                <li><a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Blog</a></li>
                <li>
                  <a
                    href={supportUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Support
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="kinetic-headline font-semibold mb-4">Company</h3>
              <ul className="space-y-2">
                <li><a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">About Us</a></li>
                <li><a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Careers</a></li>
                <li><a href="mailto:admin@moderateai.net" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Contact</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-muted-foreground mb-4 md:mb-0">
              (c) {new Date().getFullYear()} ModerateAI. All rights reserved.
            </p>
            <div className="flex space-x-6">
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</a>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default LandingPage;

