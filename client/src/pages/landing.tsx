import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { 
  MessagesSquare, 
  CheckCircle, 
  Shield, 
  Sparkles, 
  ArrowRight, 
  Globe,
  SendHorizontal,
  MessageSquareMore
} from "lucide-react";
import { Logo } from "@/components/logo";
import ChatWidget from "@/components/chat/chat-widget";

const LandingPage = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isYearly, setIsYearly] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="py-4 px-6 md:px-8 border-b border-border">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          {/* Logo */}
          <Logo />

          {/* Navigation - Desktop */}
          <nav className="hidden md:flex items-center space-x-8">
            <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
            <a href="#integrations" className="text-muted-foreground hover:text-foreground transition-colors">Integrations</a>
            <Link href="/dashboard">
              <Button variant="default">Go to Dashboard</Button>
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
          <div className="md:hidden py-4 px-6 mt-2 bg-card rounded-lg shadow-md">
            <nav className="flex flex-col space-y-4">
              <a 
                href="#features" 
                className="text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Features
              </a>
              <a 
                href="#pricing" 
                className="text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Pricing
              </a>
              <a 
                href="#integrations" 
                className="text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                Integrations
              </a>
              <Link href="/dashboard">
                <Button variant="default" className="w-full">Go to Dashboard</Button>
              </Link>
            </nav>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="py-20 px-6 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-6">
                AI-Powered 
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-600 ml-2">
                  Customer Support
                </span>
              </h1>
              <p className="text-xl text-muted-foreground mb-8">
                Streamline your community moderation and customer support with intelligent, adaptive AI responses across all your platforms.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/dashboard">
                  <Button size="lg" className="w-full sm:w-auto">
                    Get Started 
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <a href="#features">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto">
                    Learn More
                  </Button>
                </a>
              </div>
            </div>
            <div className="hidden md:block bg-card rounded-xl shadow-lg p-8 border border-border">
              <div className="space-y-4">
                <div className="rounded-md bg-accent p-4">
                  <h3 className="font-medium mb-2">Welcome to ModerateAI!</h3>
                  <p className="text-muted-foreground text-sm">
                    I'm your AI assistant. I can help detect inappropriate content and provide customer support across all your platforms.
                  </p>
                </div>
                <div className="bg-primary/10 rounded-md p-4 flex items-start">
                  <div className="mr-3 mt-1">
                    <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                      <MessagesSquare className="h-4 w-4 text-primary" />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm">
                      How does ModerateAI handle content moderation across different platforms?
                    </p>
                  </div>
                </div>
                <div className="rounded-md p-4 flex items-start">
                  <div className="mr-3 mt-1">
                    <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
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
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-6 md:px-8 bg-accent/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Powerful Features</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Everything you need to provide exceptional customer support and community moderation.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
              <div className="rounded-full bg-primary/10 p-3 w-fit mb-4">
                <MessagesSquare className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Multi-platform Integration</h3>
              <p className="text-muted-foreground">
                Seamlessly connect with your website, Telegram groups, and Discord servers to provide consistent support across all channels.
              </p>
            </div>
            
            {/* Feature 2 */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
              <div className="rounded-full bg-primary/10 p-3 w-fit mb-4">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Intelligent Moderation</h3>
              <p className="text-muted-foreground">
                Automatically detect and filter inappropriate content, spam, and toxic behavior to maintain a healthy community environment.
              </p>
            </div>
            
            {/* Feature 3 */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
              <div className="rounded-full bg-primary/10 p-3 w-fit mb-4">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Custom AI Configuration</h3>
              <p className="text-muted-foreground">
                Fine-tune your AI assistant's responses with customizable tone, length, and knowledge base for personalized interactions.
              </p>
            </div>
            
            {/* Feature 4 */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
              <div className="rounded-full bg-primary/10 p-3 w-fit mb-4">
                <CheckCircle className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Knowledge Base Integration</h3>
              <p className="text-muted-foreground">
                Upload documents and FAQs to enable your AI assistant to provide accurate and contextual responses to user queries.
              </p>
            </div>
            
            {/* Feature 5 */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
              <div className="rounded-full bg-primary/10 p-3 w-fit mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Analytics & Insights</h3>
              <p className="text-muted-foreground">
                Track conversations, response rates, and moderation actions with comprehensive analytics to improve your support strategy.
              </p>
            </div>
            
            {/* Feature 6 */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
              <div className="rounded-full bg-primary/10 p-3 w-fit mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Customizable Templates</h3>
              <p className="text-muted-foreground">
                Create and save response templates for common queries to maintain consistency and save time in customer interactions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Integrations Section */}
      <section id="integrations" className="py-20 px-6 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Seamless Integrations</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Connect with your favorite platforms for unified customer support and moderation.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Website Integration */}
            <div className="bg-card border border-border rounded-xl p-8 shadow-sm text-center">
              <div className="rounded-full bg-primary/10 p-4 w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                <Globe className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Website Chat Widget</h3>
              <p className="text-muted-foreground mb-6">
                Embed an AI-powered chat widget on your website to provide instant support to your visitors.
              </p>
              <Link href="/integrations/website">
                <Button variant="outline" className="w-full">Learn More</Button>
              </Link>
            </div>
            
            {/* Telegram Integration */}
            <div className="bg-card border border-border rounded-xl p-8 shadow-sm text-center">
              <div className="rounded-full bg-primary/10 p-4 w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                <SendHorizontal className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Telegram Bot</h3>
              <p className="text-muted-foreground mb-6">
                Add an AI assistant to your Telegram groups to moderate content and answer user questions.
              </p>
              <Link href="/integrations/telegram">
                <Button variant="outline" className="w-full">Learn More</Button>
              </Link>
            </div>
            
            {/* Discord Integration */}
            <div className="bg-card border border-border rounded-xl p-8 shadow-sm text-center">
              <div className="rounded-full bg-primary/10 p-4 w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                <MessageSquareMore className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Discord Bot</h3>
              <p className="text-muted-foreground mb-6">
                Integrate with Discord to automate moderation and provide support in your server channels.
              </p>
              <Link href="/integrations/discord">
                <Button variant="outline" className="w-full">Learn More</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-6 md:px-8 bg-accent/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
              Choose the plan that fits your needs. All plans include access to all integrations. No credit card required during free trial and you can cancel anytime.
            </p>
            
            {/* Billing Period Toggle */}
            <div className="flex items-center justify-center space-x-4 mb-8">
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
                <span className="ml-2 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs font-medium rounded-full px-2 py-0.5">
                  Save 15%
                </span>
              </span>
            </div>
          </div>
          
          <div className="grid md:grid-cols-4 gap-8">
            {/* Free Plan */}
            <div className="bg-card border border-border rounded-xl p-8 shadow-sm">
              <h3 className="text-xl font-semibold mb-2">Free</h3>
              <div className="mb-4">
                <span className="text-4xl font-bold">$0</span>
                <span className="text-muted-foreground">/month</span>
                <div className="mt-1 text-sm text-blue-600 font-medium">Free forever</div>
              </div>
              <p className="text-muted-foreground mb-6">
                Perfect for individuals and testing.
              </p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  <span>Up to 20 AI responses/month</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  <span>Basic moderation tools</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  <span>All platform integrations</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  <span>10 response templates</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  <span>Community chat history for training</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  <span>5 template insights per month</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  <span>Unlimited collaborator seats</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  <span>Tracking 5 unanswered inquiries/month</span>
                </li>
              </ul>
              <Button className="w-full" variant="outline">Get Started Free</Button>
            </div>

            {/* Basic Plan */}
            <div className="bg-card border border-border rounded-xl p-8 shadow-sm">
              <h3 className="text-xl font-semibold mb-2">Basic</h3>
              <div className="mb-4">
                <span className="text-4xl font-bold">{isYearly ? '$68' : '$80'}</span>
                <span className="text-muted-foreground">{isYearly ? '/month, billed annually' : '/month'}</span>
                <div className="mt-1 text-sm text-green-600 font-medium">14-day free trial included</div>
              </div>
              <p className="text-muted-foreground mb-6">
                Perfect for small communities and startups.
              </p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  <span>150 AI responses/month</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  <span>Basic moderation rules</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  <span>All platform integrations</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  <span>Unlimited response templates</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  <span>Community chat history for training</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  <span>Unlimited template insights</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  <span>Unlimited collaborator seats</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  <span>Unlimited tracking of unanswered inquiries</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  <span>Access to support team</span>
                </li>
              </ul>
              <Button className="w-full">Start Free Trial</Button>
            </div>
            
            {/* Pro Plan */}
            <div className="bg-card border-2 border-primary rounded-xl p-8 shadow-lg relative">
              <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-3 py-1 text-sm font-medium transform translate-y-[-50%] rounded-full">
                Most Popular
              </div>
              <h3 className="text-xl font-semibold mb-2">Pro</h3>
              <div className="mb-4">
                <span className="text-4xl font-bold">{isYearly ? '$127' : '$150'}</span>
                <span className="text-muted-foreground">{isYearly ? '/month, billed annually' : '/month'}</span>
                <div className="mt-1 text-sm text-green-600 font-medium">14-day free trial included</div>
              </div>
              <p className="text-muted-foreground mb-6">
                Ideal for growing communities and businesses.
              </p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  <span>Up to 5,000 AI responses/month</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  <span>Advanced moderation tools</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  <span>Custom knowledge base</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  <span>20 response templates</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  <span>Priority support</span>
                </li>
              </ul>
              <Button className="w-full">Start Free Trial</Button>
            </div>
            
            {/* Enterprise Plan */}
            <div className="bg-card border border-border rounded-xl p-8 shadow-sm">
              <h3 className="text-xl font-semibold mb-2">Enterprise</h3>
              <div className="mb-4">
                <span className="text-4xl font-bold">Custom</span>
                <div className="mt-1 text-sm text-green-600 font-medium">14-day free trial included</div>
              </div>
              <p className="text-muted-foreground mb-6">
                For large organizations with specific needs.
              </p>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  <span>Unlimited AI responses</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  <span>Premium moderation tools</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  <span>Multiple knowledge bases</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  <span>Unlimited response templates</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  <span>Dedicated account manager</span>
                </li>
                <li className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                  <span>Custom integrations</span>
                </li>
              </ul>
              <Button variant="outline" className="w-full">Contact Sales</Button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 md:px-8">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to transform your customer support?</h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            Join thousands of businesses that are using ModerateAI to provide excellent customer support and community moderation.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link href="/dashboard">
              <Button size="lg" variant="outline">
                Start Free Forever
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button size="lg">
                Start 14-Day Pro Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
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
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2">
                <li><a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</a></li>
                <li><a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</a></li>
                <li><a href="#integrations" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Integrations</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Resources</h3>
              <ul className="space-y-2">
                <li><a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Documentation</a></li>
                <li><a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Blog</a></li>
                <li><a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Support</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2">
                <li><a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">About Us</a></li>
                <li><a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Careers</a></li>
                <li><a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Contact</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-border mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-muted-foreground mb-4 md:mb-0">
              © {new Date().getFullYear()} ModerateAI. All rights reserved.
            </p>
            <div className="flex space-x-6">
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</a>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>
      
      {/* Chat Widget */}
      <ChatWidget />
    </div>
  );
};

export default LandingPage;