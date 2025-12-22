import React, { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Activity, Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertCircle, ArrowRight, Loader2, MessageSquare } from 'lucide-react';

interface ValidationError {
  column?: string;
  message: string;
  row?: number;
}

interface UploadResponse {
  success: boolean;
  message: string;
  errors?: ValidationError[];
  preview?: any[];
  row_count?: number;
  file_id?: string;
}

export default function UploadPage() {
  const router = useRouter();
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [uploadResponse, setUploadResponse] = useState<UploadResponse | null>(null);
  const [previewData, setPreviewData] = useState<any[] | null>(null);

  const REQUIRED_COLUMNS = ['numorden', 'sexo', 'edad', 'nombre', 'textores', 'nombre2', 'Date'];
  const ACCEPTED_TYPES = ['.csv', '.xlsx', '.xls'];

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (selectedFile: File) => {
    const fileExtension = '.' + selectedFile.name.split('.').pop()?.toLowerCase();
    
    if (!ACCEPTED_TYPES.includes(fileExtension)) {
      setUploadResponse({
        success: false,
        message: 'Type de fichier non supporté. Veuillez sélectionner un fichier CSV ou Excel (.xlsx, .xls)',
        errors: [{ message: `Extension ${fileExtension} non acceptée` }]
      });
      return;
    }

    setFile(selectedFile);
    setUploadResponse(null);
    setPreviewData(null);
  };

  const validateAndUpload = async () => {
    if (!file) return;

    setUploading(true);
    setValidating(true);
    setUploadResponse(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:8000/api/ingest', {
        method: 'POST',
        body: formData,
      });

      const data: UploadResponse = await response.json();
      
      setUploadResponse(data);
      
      if (data.success && data.preview) {
        setPreviewData(data.preview);
      }
    } catch (error) {
      setUploadResponse({
        success: false,
        message: 'Erreur de connexion au serveur. Veuillez réessayer.',
        errors: [{ message: 'Impossible de se connecter au backend' }]
      });
    } finally {
      setUploading(false);
      setValidating(false);
    }
  };

  const handleProceedToExplorer = () => {
    if (uploadResponse?.file_id) {
      router.push(`/explorer?file_id=${uploadResponse.file_id}`);
    } else {
      router.push('/explorer');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-cyan-50 flex flex-col">
      {/* Header */}
      {/* Header */}
      <header className="border-b border-gray-100 bg-white sticky top-0 z-50 shadow-sm">
        <div className="max-w-screen-3xl mx-auto w-full px-4 sm:px-6 lg:px-12 xl:px-16 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Activity className="w-9 h-9 sm:w-10 sm:h-10 text-cyan-500" />
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-cyan-500 to-blue-600 bg-clip-text text-transparent">
                LabLens
              </h1>
            </div>
            
            <nav className="flex items-center space-x-8 text-sm sm:text-base lg:text-lg">
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

      <div className="flex-1 max-w-screen-3xl mx-auto w-full px-4 sm:px-6 lg:px-12 xl:px-16 py-12">
        {/* Title Section */}
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-cyan-500 to-blue-600 bg-clip-text text-transparent">
            Télécharger vos Données
          </h1>
          <p className="text-gray-600 text-base sm:text-lg md:text-xl">
            Importez votre fichier CSV ou Excel pour commencer l'analyse
          </p>
        </div>

        {/* Upload Area */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8 max-w-4xl mx-auto">
          <div
            className={`border-3 border-dashed rounded-xl p-12 text-center transition-all duration-300 ${
              dragActive
                ? 'border-cyan-500 bg-cyan-50'
                : 'border-gray-300 hover:border-cyan-400 hover:bg-gray-50'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center space-y-4">
              <div className="w-20 h-20 bg-gradient-to-br from-cyan-100 to-blue-100 rounded-full flex items-center justify-center">
                {uploading ? (
                  <Loader2 className="w-10 h-10 text-cyan-500 animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-10 h-10 text-cyan-500" />
                )}
              </div>
              
              {!file ? (
                <>
                  <h3 className="text-lg sm:text-xl md:text-2xl font-semibold text-gray-700">
                    Glissez-déposez votre fichier ici
                  </h3>
                  <p className="text-gray-500 text-sm sm:text-base">ou</p>
                  <label className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold rounded-full cursor-pointer hover:scale-105 transition-transform shadow-lg text-sm sm:text-base">
                    Parcourir les fichiers
                    <input
                      type="file"
                      className="hidden"
                      accept=".csv,.xlsx,.xls"
                      onChange={(e) => e.target.files && handleFileSelect(e.target.files[0])}
                    />
                  </label>
                  <p className="text-xs sm:text-sm text-gray-400">
                    Formats acceptés: CSV, XLSX, XLS (max 50 MB)
                  </p>
                </>
              ) : (
                <>
                  <div className="flex items-center space-x-3 bg-cyan-50 px-6 py-3 rounded-lg">
                    <FileSpreadsheet className="w-6 h-6 text-cyan-500" />
                    <span className="font-medium text-gray-700">{file.name}</span>
                    <span className="text-xs sm:text-sm text-gray-500">
                      ({(file.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                  </div>
                  
                  <div className="flex space-x-4">
                    <button
                      onClick={validateAndUpload}
                      disabled={uploading}
                      className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold rounded-full hover:scale-105 transition-transform shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 text-sm sm:text-base"
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Validation en cours...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-5 h-5" />
                          <span>Valider et Télécharger</span>
                        </>
                      )}
                    </button>
                    
                    <button
                      onClick={() => {
                        setFile(null);
                        setUploadResponse(null);
                        setPreviewData(null);
                      }}
                      className="px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-full hover:bg-gray-50 transition-colors"
                    >
                      Annuler
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Schema Requirements */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="font-semibold text-blue-900 mb-2 flex items-center space-x-2">
              <AlertCircle className="w-5 h-5" />
              <span>Colonnes requises</span>
            </h4>
            <div className="flex flex-wrap gap-2">
              {REQUIRED_COLUMNS.map((col) => (
                <span key={col} className="px-3 py-1 bg-white text-blue-700 text-sm font-medium rounded-full border border-blue-300">
                  {col}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Validation Results */}
        {uploadResponse && (
          <div className={`bg-white rounded-2xl shadow-xl p-8 mb-8 border-l-4 max-w-4xl mx-auto ${
            uploadResponse.success ? 'border-green-500' : 'border-red-500'
          }`}>
            <div className="flex items-start space-x-4">
              {uploadResponse.success ? (
                <CheckCircle2 className="w-8 h-8 text-green-500 flex-shrink-0" />
              ) : (
                <XCircle className="w-8 h-8 text-red-500 flex-shrink-0" />
              )}
              
              <div className="flex-1">
                <h3 className={`text-lg sm:text-xl md:text-2xl font-bold mb-2 ${
                  uploadResponse.success ? 'text-green-700' : 'text-red-700'
                }`}>
                  {uploadResponse.success ? 'Validation Réussie !' : 'Erreurs de Validation'}
                </h3>
                
                <p className="text-gray-700 mb-4 text-sm sm:text-base md:text-lg">{uploadResponse.message}</p>
                
                {uploadResponse.row_count && (
                  <p className="text-xs sm:text-sm text-gray-600">
                    <strong>{uploadResponse.row_count}</strong> lignes détectées
                  </p>
                )}

                {uploadResponse.errors && uploadResponse.errors.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <h4 className="font-semibold text-red-700 text-sm sm:text-base">Détails des erreurs:</h4>
                    {uploadResponse.errors.map((error, idx) => (
                      <div key={idx} className="flex items-start space-x-2 text-xs sm:text-sm">
                        <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700">
                          {error.column && <strong>{error.column}:</strong>} {error.message}
                          {error.row && <span className="text-gray-500"> (ligne {error.row})</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {uploadResponse.success && (
                  <button
                    onClick={handleProceedToExplorer}
                    className="mt-6 px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-full hover:scale-105 transition-transform shadow-lg flex items-center space-x-2 text-sm sm:text-base"
                  >
                    <span>Analyser les Données</span>
                    <ArrowRight className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Data Preview */}
        {previewData && previewData.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl p-8 max-w-4xl mx-auto">
            <h3 className="text-xl sm:text-2xl md:text-3xl font-bold mb-6 text-gray-800">
              Aperçu des Données (5 premières lignes)
            </h3>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-cyan-50 to-blue-50">
                  <tr>
                    {Object.keys(previewData[0]).map((header) => (
                      <th
                        key={header}
                        className="px-4 py-3 text-left text-xs sm:text-sm font-semibold text-gray-700 uppercase tracking-wider"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {previewData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      {Object.values(row).map((cell: any, cellIdx) => (
                        <td key={cellIdx} className="px-4 py-3 text-xs sm:text-sm text-gray-700 whitespace-nowrap">
                          {cell !== null && cell !== undefined ? String(cell) : '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}      
      </div>

      {/* Footer */}
      <footer className="bg-gradient-to-r from-cyan-500 to-blue-600 py-12">
        <div className="max-w-screen-3xl mx-auto w-full px-4 sm:px-6 lg:px-12 xl:px-16">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <Activity className="w-9 h-9 sm:w-10 sm:h-10 text-white" />
              <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">LabLens</h3>
            </div>
            <p className="text-white/90 mb-6 text-base sm:text-lg md:text-xl">
              IDSCC 5 — Artificial Intelligence, ENSAO
            </p>
            <p className="text-white/90 mb-2 text-base sm:text-lg md:text-xl">
              Prof. Abdelmounaim Kerkri
            </p>
            <p className="text-white/90 mb-6">
              National School of Applied Sciences (ENSAO), Mohammed First University
            </p>
            <div className="flex items-center justify-center space-x-6 text-sm sm:text-base md:text-lg text-white/80">
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
              <p className="text-white/70 text-sm sm:text-base">
                © 2025 LabLens. Tous droits réservés.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}