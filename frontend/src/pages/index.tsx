import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Activity, Upload, Search, Database, BarChart3, MessageSquare, TrendingUp, Users, Shield, CheckCircle2, PlayCircle } from 'lucide-react';

export default function LabLensHome() {
  const router = useRouter();
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);
  const [hoveredTitle, setHoveredTitle] = useState(false);
  const [chatbotOpen, setChatbotOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-100 bg-white sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Activity className="w-8 h-8 text-cyan-500" />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-500 to-blue-600 bg-clip-text text-transparent">
                LabLens
              </h1>
            </div>

            <nav className="flex items-center space-x-8">
              <Link
                href="/"
                className="relative px-4 py-2 text-gray-700 font-medium transition-all duration-300"
                onMouseEnter={() => setHoveredNav('Home')}
                onMouseLeave={() => setHoveredNav(null)}
                style={{
                  transform: hoveredNav === 'Home' ? 'translateY(-2px)' : 'translateY(0)',
                  color: hoveredNav === 'Home' ? '#06b6d4' : '#374151'
                }}
              >
                Home
                {hoveredNav === 'Home' && (
                  <span className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full" />
                )}
              </Link>
              <Link
                href="/upload"
                className="relative px-4 py-2 text-gray-700 font-medium transition-all duration-300"
                onMouseEnter={() => setHoveredNav('Upload')}
                onMouseLeave={() => setHoveredNav(null)}
                style={{
                  transform: hoveredNav === 'Upload' ? 'translateY(-2px)' : 'translateY(0)',
                  color: hoveredNav === 'Upload' ? '#06b6d4' : '#374151'
                }}
              >
                Upload
                {hoveredNav === 'Upload' && (
                  <span className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full" />
                )}
              </Link>
              <Link
                href="/explorer"
                className="relative px-4 py-2 text-gray-700 font-medium transition-all duration-300"
                onMouseEnter={() => setHoveredNav('Explorer')}
                onMouseLeave={() => setHoveredNav(null)}
                style={{
                  transform: hoveredNav === 'Explorer' ? 'translateY(-2px)' : 'translateY(0)',
                  color: hoveredNav === 'Explorer' ? '#06b6d4' : '#374151'
                }}
              >
                Explorer
                {hoveredNav === 'Explorer' && (
                  <span className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full" />
                )}
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Chatbot Button */}
      <button
        onClick={() => router.push('/assistant')}
        className="fixed bottom-8 right-8 w-16 h-16 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-cyan-500/50 z-50"
      >
        <MessageSquare className="w-7 h-7 text-white" />
      </button>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center" style={{
        backgroundImage: 'url(piw.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}>
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900/90 to-cyan-900/80"></div>

        <div className="relative z-10 max-w-7xl mx-auto px-6 py-20 w-full">
          <div className="text-center">
            <h1
              className="text-6xl font-bold mb-6 transition-all duration-300 cursor-pointer inline-block text-white"
              onMouseEnter={() => setHoveredTitle(true)}
              onMouseLeave={() => setHoveredTitle(false)}
              style={{
                transform: hoveredTitle ? 'scale(1.05)' : 'scale(1)',
                textShadow: hoveredTitle ? '0 10px 40px rgba(255, 255, 255, 0.5)' : '0 4px 20px rgba(0, 0, 0, 0.3)'
              }}
            >
              Interactive Blood-Work Explorer
            </h1>

            <p className="text-xl text-white/90 mb-12 max-w-3xl mx-auto drop-shadow-lg">
              Explorez, analysez et visualisez vos données de laboratoire avec une plateforme intelligente alimentée par l'IA
            </p>

            <div className="flex flex-col items-center space-y-6 mb-12">
              <div className="flex items-center space-x-3 text-white">
                <CheckCircle2 className="w-6 h-6 text-cyan-400" />
                <span className="text-lg">Validation de schéma stricte et filtres personnalisés</span>
              </div>
              <div className="flex items-center space-x-3 text-white">
                <CheckCircle2 className="w-6 h-6 text-cyan-400" />
                <span className="text-lg">Statistiques descriptives et visualisations avancées</span>
              </div>
              <div className="flex items-center space-x-3 text-white">
                <CheckCircle2 className="w-6 h-6 text-cyan-400" />
                <span className="text-lg">Assistant IA pour requêtes en langage naturel</span>
              </div>
              <div className="flex items-center space-x-3 text-white">
                <CheckCircle2 className="w-6 h-6 text-cyan-400" />
                <span className="text-lg">Analyses de panels et tests répétés</span>
              </div>
            </div>

            <button
              onClick={() => router.push('/upload')}
              className="px-12 py-5 bg-cyan-500 hover:bg-cyan-400 text-white text-lg font-semibold rounded-full shadow-2xl hover:scale-105 transition-all duration-300 cursor-pointer"
            >
              Commencer l'Analyse
            </button>

            {/* Video Demo */}
            <div className="mt-20 relative">
              <div className="aspect-video bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl shadow-2xl overflow-hidden group cursor-pointer border-4 border-white/20">
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-all duration-300">
                  <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-2xl">
                    <PlayCircle className="w-16 h-16 text-cyan-500" />
                  </div>
                </div>
                <div className="absolute bottom-8 left-8 text-white">
                  <p className="text-3xl font-bold drop-shadow-lg">Démo de la Plateforme</p>
                  <p className="text-lg text-white/80 mt-2">Découvrez LabLens en action</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-4xl font-bold text-center mb-4 bg-gradient-to-r from-cyan-500 to-blue-600 bg-clip-text text-transparent">
            Ce Que Nous Offrons
          </h2>
          <p className="text-center text-gray-600 mb-16 text-lg">
            Des outils puissants pour transformer vos données de laboratoire en insights actionnables
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <Database className="w-12 h-12" />,
                title: "Chargement & Filtrage",
                description: "Importez vos fichiers CSV avec validation de schéma stricte et créez des filtres personnalisés pour explorer vos cohortes"
              },
              {
                icon: <BarChart3 className="w-12 h-12" />,
                title: "Statistiques & Visualisations",
                description: "Analyses descriptives complètes avec distributions, tendances temporelles et panels de tests co-ordonnés"
              },
              {
                icon: <MessageSquare className="w-12 h-12" />,
                title: "Assistant IA",
                description: "Interrogez vos données en langage naturel avec exécution sécurisée et explications détaillées des requêtes"
              },
              {
                icon: <TrendingUp className="w-12 h-12" />,
                title: "Analyses de Panels",
                description: "Visualisez les tests effectués le même jour et identifiez les patterns de tests répétés par patient"
              },
              {
                icon: <Users className="w-12 h-12" />,
                title: "Vues de Cohortes",
                description: "Sauvegardez et partagez vos filtres personnalisés pour une collaboration efficace entre équipes"
              },
              {
                icon: <Shield className="w-12 h-12" />,
                title: "Sécurité & Confidentialité",
                description: "Contrôle d'accès basé sur les rôles, chiffrement des données et journalisation complète des audits"
              }
            ].map((feature, idx) => (
              <div
                key={idx}
                className="bg-white p-8 rounded-2xl shadow-md hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border border-gray-100 group"
              >
                <div className="text-cyan-500 mb-4 group-hover:scale-110 transition-transform duration-300">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold mb-3 text-gray-800">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 max-w-7xl mx-auto px-6">
        <h2 className="text-4xl font-bold mb-12 text-center">Pourquoi Choisir LabLens?</h2>
        <div className="grid md:grid-cols-2 gap-6">
          {/* Card 1 - Image Left */}
          <div className="flex bg-gray-100 rounded-lg overflow-hidden shadow-lg">
            <div className="w-1/2">
              <img
                src="https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=400&h=400&fit=crop"
                alt="Interface"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="w-1/2 flex flex-col justify-center p-6 bg-white">
              <h3 className="text-xl font-bold mb-3 text-gray-800">INTERFACE INTUITIVE</h3>
              <p className="text-gray-600 text-sm">Interface intuitive et réactive pour tous les utilisateurs</p>
            </div>
          </div>

          {/* Card 2 - Image Right */}
          <div className="flex bg-gray-100 rounded-lg overflow-hidden shadow-lg">
            <div className="w-1/2 flex flex-col justify-center p-6 bg-white">
              <h3 className="text-xl font-bold mb-3 text-gray-800">PERFORMANCE OPTIMISÉE</h3>
              <p className="text-gray-600 text-sm">Performance optimisée avec latence p95 inferieur a 1s</p>
            </div>
            <div className="w-1/2">
              <img
                src="https://images.unsplash.com/photo-1530210124550-912dc1381cb8?w=400&h=400&fit=crop"
                alt="Performance"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Card 3 - Image Left */}
          <div className="flex bg-gray-100 rounded-lg overflow-hidden shadow-lg">
            <div className="w-1/2">
              <img
                src="https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=400&h=400&fit=crop"
                alt="Exportation"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="w-1/2 flex flex-col justify-center p-6 bg-white">
              <h3 className="text-xl font-bold mb-3 text-gray-800">EXPORTATION FLEXIBLE</h3>
              <p className="text-gray-600 text-sm">Exportation flexible en CSV/XLSX</p>
            </div>
          </div>

          {/* Card 4 - Image Right */}
          <div className="flex bg-gray-100 rounded-lg overflow-hidden shadow-lg">
            <div className="w-1/2 flex flex-col justify-center p-6 bg-white">
              <h3 className="text-xl font-bold mb-3 text-gray-800">SANDBOX SÉCURISÉ</h3>
              <p className="text-gray-600 text-sm">Sandbox sécurisé pour les requêtes LLM</p>
            </div>
            <div className="w-1/2">
              <img
                src="https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?w=400&h=400&fit=crop"
                alt="Sécurité"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          {/* Card 5 - Image Left */}
          <div className="flex bg-gray-100 rounded-lg overflow-hidden shadow-lg">
            <div className="w-1/2">
              <img
                src="https://images.unsplash.com/photo-1551076805-e1869033e561?w=400&h=400&fit=crop"
                alt="Datasets"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="w-1/2 flex flex-col justify-center p-6 bg-white">
              <h3 className="text-xl font-bold mb-3 text-gray-800">SUPPORT DATASETS</h3>
              <p className="text-gray-600 text-sm">Support de datasets jusqu'à 500k lignes</p>
            </div>
          </div>

          {/* Card 6 - Image Right */}
          <div className="flex bg-gray-100 rounded-lg overflow-hidden shadow-lg">
            <div className="w-1/2 flex flex-col justify-center p-6 bg-white">
              <h3 className="text-xl font-bold mb-3 text-gray-800">DOCUMENTATION COMPLÈTE</h3>
              <p className="text-gray-600 text-sm">Documentation complète et support technique</p>
            </div>
            <div className="w-1/2">
              <img
                src="https://images.unsplash.com/photo-1581092160562-40aa08e78837?w=400&h=400&fit=crop"
                alt="Documentation"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gradient-to-r from-cyan-500 to-blue-600 py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <Activity className="w-8 h-8 text-white" />
              <h3 className="text-2xl font-bold text-white">LabLens</h3>
            </div>
            <p className="text-white/90 mb-6">
              IDSCC 5 — Artificial Intelligence, ENSAO
            </p>
            <p className="text-white/90 mb-2">
              Prof. Abdelmounaim Kerkri
            </p>
            <p className="text-white/90 mb-6">
              National School of Applied Sciences (ENSAO), Mohammed First University
            </p>
            <div className="flex items-center justify-center space-x-6 text-sm text-white/80">
              <span>Farah</span>
              <span>•</span>
              <span>Zineb</span>
              <span>•</span>
              <span>Oumaima</span>
              <span>•</span>
              <span>Toufali</span>
              <span>•</span>
              <span>Qritel</span>
              <span>•</span>
              <span>Salima</span>
            </div>
            <div className="mt-6 pt-6 border-t border-white/20">
              <p className="text-white/70 text-sm">
                © 2025 LabLens. Tous droits réservés.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}