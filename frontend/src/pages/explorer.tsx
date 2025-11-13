import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import {
  Activity, Filter, Database, BarChart3, TrendingUp, Users,
  Plus, X, Play, Download, Save, Share2, Eye, EyeOff,
  Calendar, Hash, User, TestTube, FileText, Loader2, AlertCircle, MessageSquare,
  Layers, Repeat, Network
} from 'lucide-react';

interface FilterCondition {
  id: string;
  column: string;
  operator: string;
  value: string;
}

interface StatsSummary {
  total_rows: number;
  unique_patients: number;
  unique_tests: number;
  date_range: { min: string; max: string };
  age_stats: { mean: number; std: number; min: number; max: number };
  sex_distribution: { [key: string]: number };
}

export default function ExplorerPage() {
  const router = useRouter();
  const { file_id } = router.query;

  const [hoveredNav, setHoveredNav] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'manual' | 'sql'>('manual');
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [sqlQuery, setSqlQuery] = useState('');
  const [showSqlPreview, setShowSqlPreview] = useState(false);
  const [sqlPreview, setSqlPreview] = useState<any>(null);
  const [executingSql, setExecutingSql] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allData, setAllData] = useState<any[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [stats, setStats] = useState<StatsSummary | null>(null);

  const [activeTab, setActiveTab] = useState<'overview' | 'panels' | 'repeats' | 'coorder'>('overview');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  
  // Data for tabs
  const [panelsData, setPanelsData] = useState<any>(null);
  const [repeatsData, setRepeatsData] = useState<any>(null);
  const [coorderData, setCoorderData] = useState<any>(null);
  const [loadingTab, setLoadingTab] = useState(false);

  const COLUMNS = ['numorden', 'sexo', 'edad', 'nombre', 'textores', 'nombre2', 'Date'];
  const OPERATORS = ['=', '!=', '>', '<', '>=', '<=', 'LIKE', 'IN'];

  useEffect(() => {
    if (file_id) {
      loadDataFromBackend();
    }
  }, [file_id]);

  useEffect(() => {
    if (file_id && activeTab !== 'overview') {
      loadTabData();
    }
  }, [file_id, activeTab]);

  const loadTabData = async () => {
    if (!file_id) return;
    
    setLoadingTab(true);
    try {
      if (activeTab === 'panels') {
        const response = await fetch(`http://localhost:8000/api/panels/${file_id}`);
        if (response.ok) {
          const data = await response.json();
          setPanelsData(data);
        }
      } else if (activeTab === 'repeats') {
        const response = await fetch(`http://localhost:8000/api/repeats/${file_id}`);
        if (response.ok) {
          const data = await response.json();
          setRepeatsData(data);
        }
      } else if (activeTab === 'coorder') {
        const response = await fetch(`http://localhost:8000/api/coorder/${file_id}?top_n=50`);
        if (response.ok) {
          const data = await response.json();
          setCoorderData(data);
        }
      }
    } catch (err: any) {
      console.error('Error loading tab data:', err);
      setError(err.message || 'Erreur lors du chargement des données');
    } finally {
      setLoadingTab(false);
    }
  };

  useEffect(() => {
    // Appliquer les filtres manuels seulement si on est en mode manuel
    if (filterMode === 'manual' && allData.length > 0) {
      applyFiltersLocally();
    }
  }, [filters, allData, filterMode]);

  const loadDataFromBackend = async () => {
    if (!file_id) return;

    setLoading(true);
    setError(null);

    try {
      // Charger les données depuis le backend
      const response = await fetch(`http://localhost:8000/api/files/${file_id}/data?limit=10000`);

      if (!response.ok) {
        throw new Error('Fichier non trouvé');
      }

      const result = await response.json();

      if (result.data && result.data.length > 0) {
        setAllData(result.data);
        setFilteredData(result.data);
        computeStatistics(result.data);
      } else {
        setError('Aucune donnée disponible');
      }
    } catch (err: any) {
      console.error('Error loading data:', err);
      setError(err.message || 'Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const computeStatistics = (data: any[]) => {
    if (data.length === 0) return;

    // Total rows
    const total_rows = data.length;

    // Unique patients
    const unique_patients = new Set(data.map(row => row.numorden)).size;

    // Unique tests
    const unique_tests = new Set(data.map(row => row.nombre)).size;

    // Date range
    const dates = data
      .map(row => row.date)
      .filter(d => d)
      .map(d => new Date(d))
      .sort((a, b) => a.getTime() - b.getTime());

    const date_range = {
      min: dates.length > 0 ? dates[0].toISOString().split('T')[0] : '',
      max: dates.length > 0 ? dates[dates.length - 1].toISOString().split('T')[0] : ''
    };

    // Age statistics
    const ages = data
      .map(row => parseInt(row.edad))
      .filter(age => !isNaN(age));

    const age_mean = ages.reduce((a, b) => a + b, 0) / ages.length;
    const age_variance = ages.reduce((sum, age) => sum + Math.pow(age - age_mean, 2), 0) / ages.length;
    const age_std = Math.sqrt(age_variance);

    const age_stats = {
      mean: age_mean,
      std: age_std,
      min: Math.min(...ages),
      max: Math.max(...ages)
    };

    // Sex distribution
    const sex_distribution: { [key: string]: number } = {};
    data.forEach(row => {
      const sex = row.sexo || 'Unknown';
      sex_distribution[sex] = (sex_distribution[sex] || 0) + 1;
    });

    setStats({
      total_rows,
      unique_patients,
      unique_tests,
      date_range,
      age_stats,
      sex_distribution
    });
  };

  const addFilter = () => {
    setFilters([
      ...filters,
      { id: Date.now().toString(), column: 'numorden', operator: '=', value: '' }
    ]);
  };

  const removeFilter = (id: string) => {
    setFilters(filters.filter(f => f.id !== id));
  };

  const updateFilter = (id: string, field: keyof FilterCondition, value: string) => {
    setFilters(filters.map(f =>
      f.id === id ? { ...f, [field]: value } : f
    ));
  };

  const applyFiltersLocally = () => {
    if (filters.length === 0 || filters.every(f => !f.value)) {
      setFilteredData(allData);
      computeStatistics(allData);
      return;
    }

    const filtered = allData.filter(row => {
      return filters.every(filter => {
        if (!filter.value) return true;

        const cellValue = String(row[filter.column] || '').toLowerCase();
        const filterValue = String(filter.value).toLowerCase();

        switch (filter.operator) {
          case '=':
            return cellValue === filterValue;
          case '!=':
            return cellValue !== filterValue;
          case '>':
            return parseFloat(cellValue) > parseFloat(filterValue);
          case '<':
            return parseFloat(cellValue) < parseFloat(filterValue);
          case '>=':
            return parseFloat(cellValue) >= parseFloat(filterValue);
          case '<=':
            return parseFloat(cellValue) <= parseFloat(filterValue);
          case 'LIKE':
            return cellValue.includes(filterValue);
          case 'IN':
            const values = filterValue.split(',').map(v => v.trim());
            return values.some(v => cellValue === v);
          default:
            return true;
        }
      });
    });

    setFilteredData(filtered);
    computeStatistics(filtered);
    setCurrentPage(1);
  };

  const generateSqlFromFilters = () => {
    if (filters.length === 0 || filters.every(f => !f.value)) {
      return 'SELECT * FROM results';
    }

    const conditions = filters
      .filter(f => f.value)
      .map(f => {
        if (f.operator === 'LIKE') {
          return `${f.column} LIKE '%${f.value}%'`;
        } else if (f.operator === 'IN') {
          return `${f.column} IN (${f.value})`;
        } else {
          return `${f.column} ${f.operator} '${f.value}'`;
        }
      })
      .join(' AND ');

    return `SELECT * FROM results WHERE ${conditions}`;
  };

  const previewSqlQuery = async () => {
    if (!file_id || !sqlQuery.trim()) {
      setError('Veuillez entrer une requête SQL');
      return;
    }

    setExecutingSql(true);
    setError(null);

    try {
      const response = await fetch('http://localhost:8000/api/subset/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file_id: file_id,
          query: sqlQuery.trim()
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || 'Erreur lors de la prévisualisation');
      }

      setSqlPreview(result);
    } catch (err: any) {
      console.error('Error previewing SQL:', err);
      setError(err.message || 'Erreur lors de la prévisualisation SQL');
      setSqlPreview(null);
    } finally {
      setExecutingSql(false);
    }
  };

  const executeSqlQuery = async () => {
    if (!file_id || !sqlQuery.trim()) {
      setError('Veuillez entrer une requête SQL');
      return;
    }

    setExecutingSql(true);
    setLoading(true);
    setError(null);
    setSqlPreview(null);

    try {
      const response = await fetch('http://localhost:8000/api/subset/sql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file_id: file_id,
          query: sqlQuery.trim()
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || 'Erreur lors de l\'exécution SQL');
      }

      if (result.success && result.data) {
        // Mettre à jour les données filtrées avec les résultats SQL
        setFilteredData(result.data);
        // Ne pas modifier allData pour permettre de revenir au mode manuel
        computeStatistics(result.data);
        setCurrentPage(1);
        setError(null);
      } else {
        throw new Error('Aucune donnée retournée');
      }
    } catch (err: any) {
      console.error('Error executing SQL:', err);
      setError(err.message || 'Erreur lors de l\'exécution SQL');
    } finally {
      setExecutingSql(false);
      setLoading(false);
    }
  };

  const exportData = (format: 'csv' | 'xlsx') => {
    // Simple CSV export
    if (format === 'csv') {
      const headers = COLUMNS.join(',');
      const rows = filteredData.map(row =>
        COLUMNS.map(col => {
          const value = row[col];
          return typeof value === 'string' && value.includes(',')
            ? `"${value}"`
            : value || '';
        }).join(',')
      ).join('\n');

      const csv = `${headers}\n${rows}`;
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lablens_export_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    }
  };

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentData = filteredData.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-cyan-50">
      {/* Header */}
      <header className="border-b border-gray-100 bg-white sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-3">
              <Activity className="w-8 h-8 text-cyan-500" />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-500 to-blue-600 bg-clip-text text-transparent">
                LabLens
              </h1>
            </Link>

            <nav className="flex items-center space-x-8">
              {['Home', 'Upload', 'Explorer'].map(item => (
                <Link
                  key={item}
                  href={item === 'Home' ? '/' : `/${item.toLowerCase()}`}
                  className="relative px-4 py-2 text-gray-700 font-medium transition-all duration-300"
                  onMouseEnter={() => setHoveredNav(item)}
                  onMouseLeave={() => setHoveredNav(null)}
                  style={{
                    transform: hoveredNav === item ? 'translateY(-2px)' : 'translateY(0)',
                    color: hoveredNav === item ? '#06b6d4' : '#374151'
                  }}
                >
                  {item}
                  {hoveredNav === item && (
                    <span className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full" />
                  )}
                </Link>
              ))}
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
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-cyan-500 to-blue-600 bg-clip-text text-transparent">
            Explorateur de Données
          </h1>
          <p className="text-gray-600">Filtrez, analysez et visualisez vos données de laboratoire</p>
          {file_id && (
            <p className="text-sm text-gray-500 mt-2">File ID: {file_id}</p>
          )}
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg flex items-start space-x-3">
            <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-700">Erreur</p>
              <p className="text-red-600 text-sm">{error}</p>
              <button
                onClick={() => router.push('/upload')}
                className="mt-2 text-sm text-red-600 hover:text-red-700 font-medium underline"
              >
                Retour à l'upload
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Loader2 className="w-16 h-16 text-cyan-500 animate-spin mx-auto mb-4" />
              <p className="text-gray-600 text-lg">Chargement des données...</p>
            </div>
          </div>
        )}

        {/* Main Content */}
        {!loading && !error && allData.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Sidebar - Filters */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl shadow-xl p-6 sticky top-24">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-800 flex items-center space-x-2">
                    <Filter className="w-6 h-6 text-cyan-500" />
                    <span>Filtres</span>
                  </h2>
                  {filterMode === 'manual' && (
                    <button
                      onClick={addFilter}
                      className="p-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  )}
                </div>

                {/* Filter Mode Toggle */}
                <div className="flex space-x-2 mb-6 bg-gray-100 p-1 rounded-lg">
                  <button
                    onClick={() => setFilterMode('manual')}
                    className={`flex-1 py-2 px-3 rounded-lg font-medium transition-all text-sm ${filterMode === 'manual' ? 'bg-white text-cyan-600 shadow-sm' : 'text-gray-600'
                      }`}
                  >
                    Manuel
                  </button>
                  <button
                    onClick={() => setFilterMode('sql')}
                    className={`flex-1 py-2 px-3 rounded-lg font-medium transition-all text-sm ${filterMode === 'sql' ? 'bg-white text-cyan-600 shadow-sm' : 'text-gray-600'
                      }`}
                  >
                    SQL
                  </button>
                </div>

                {/* Manual Filters */}
                {filterMode === 'manual' && (
                  <div className="space-y-4 mb-6 max-h-96 overflow-y-auto">
                    {filters.map((filter) => (
                      <div key={filter.id} className="p-4 bg-gray-50 rounded-lg space-y-3 relative">
                        <button
                          onClick={() => removeFilter(filter.id)}
                          className="absolute top-2 right-2 text-gray-400 hover:text-red-500"
                        >
                          <X className="w-4 h-4" />
                        </button>

                        <select
                          value={filter.column}
                          onChange={(e) => updateFilter(filter.id, 'column', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm"
                        >
                          {COLUMNS.map(col => (
                            <option key={col} value={col}>{col}</option>
                          ))}
                        </select>

                        <select
                          value={filter.operator}
                          onChange={(e) => updateFilter(filter.id, 'operator', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm"
                        >
                          {OPERATORS.map(op => (
                            <option key={op} value={op}>{op}</option>
                          ))}
                        </select>

                        <input
                          type="text"
                          value={filter.value}
                          onChange={(e) => updateFilter(filter.id, 'value', e.target.value)}
                          placeholder="Valeur..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm"
                        />
                      </div>
                    ))}

                    {filters.length === 0 && (
                      <p className="text-center text-gray-500 text-sm py-4">
                        Aucun filtre. Cliquez sur + pour ajouter.
                      </p>
                    )}
                  </div>
                )}

                {/* SQL Query Mode */}
                {filterMode === 'sql' && (
                  <div className="mb-6">
                    <textarea
                      value={sqlQuery}
                      onChange={(e) => {
                        setSqlQuery(e.target.value);
                        setSqlPreview(null);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent font-mono text-sm"
                      rows={8}
                      placeholder="SELECT * FROM results WHERE file_id = '...' AND ..."
                    />
                    
                    {/* SQL Preview Info */}
                    {sqlPreview && (
                      <div className={`mt-3 p-3 rounded-lg text-sm ${
                        sqlPreview.valid 
                          ? 'bg-green-50 border border-green-200 text-green-800' 
                          : 'bg-red-50 border border-red-200 text-red-800'
                      }`}>
                        {sqlPreview.valid ? (
                          <div>
                            <p className="font-semibold">✓ Requête valide</p>
                            {sqlPreview.estimated_rows !== null && (
                              <p className="text-xs mt-1">
                                Estimation: {sqlPreview.estimated_rows.toLocaleString()} lignes
                              </p>
                            )}
                          </div>
                        ) : (
                          <div>
                            <p className="font-semibold">✗ Requête invalide</p>
                            <ul className="list-disc list-inside mt-1 text-xs">
                              {sqlPreview.issues?.map((issue: string, idx: number) => (
                                <li key={idx}>{issue}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {/* SQL Action Buttons */}
                    <div className="flex space-x-2 mt-3">
                      <button
                        onClick={previewSqlQuery}
                        disabled={executingSql || !sqlQuery.trim()}
                        className="flex-1 py-2 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium flex items-center justify-center space-x-2"
                      >
                        {executingSql ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Vérification...</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-4 h-4" />
                            <span>Prévisualiser</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={executeSqlQuery}
                        disabled={executingSql || !sqlQuery.trim()}
                        className="flex-1 py-2 px-4 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium flex items-center justify-center space-x-2"
                      >
                        {executingSql ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Exécution...</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4" />
                            <span>Exécuter</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* SQL Help Text */}
                    <p className="text-xs text-gray-500 mt-3">
                      💡 Astuce: La requête doit inclure <code className="bg-gray-100 px-1 rounded">file_id</code> ou elle sera automatiquement ajoutée.
                    </p>
                  </div>
                )}

                {/* Show SQL Preview for Manual Mode */}
                {filterMode === 'manual' && filters.length > 0 && (
                  <div className="mb-6">
                    <button
                      onClick={() => setShowSqlPreview(!showSqlPreview)}
                      className="flex items-center space-x-2 text-sm text-cyan-600 hover:text-cyan-700 font-medium"
                    >
                      {showSqlPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      <span>{showSqlPreview ? 'Masquer' : 'Voir'} SQL généré</span>
                    </button>

                    {showSqlPreview && (
                      <pre className="mt-2 p-3 bg-gray-800 text-green-400 rounded-lg text-xs overflow-x-auto">
                        {generateSqlFromFilters()}
                      </pre>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-2">
                  <button
                    onClick={exportData.bind(null, 'csv')}
                    className="w-full py-2 border-2 border-cyan-500 text-cyan-600 font-medium rounded-lg hover:bg-cyan-50 transition-colors flex items-center justify-center space-x-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Exporter CSV</span>
                  </button>
                </div>

                {/* Reset Filters / Clear SQL */}
                {((filterMode === 'manual' && filters.length > 0) || (filterMode === 'sql' && sqlQuery.trim())) && (
                  <button
                    onClick={() => {
                      if (filterMode === 'manual') {
                        setFilters([]);
                        setFilteredData(allData);
                        computeStatistics(allData);
                      } else {
                        setSqlQuery('');
                        setSqlPreview(null);
                        setFilteredData(allData);
                        computeStatistics(allData);
                      }
                      setCurrentPage(1);
                    }}
                    className="w-full mt-3 py-2 text-sm text-red-600 hover:text-red-700 font-medium"
                  >
                    {filterMode === 'manual' ? 'Réinitialiser les filtres' : 'Réinitialiser la requête SQL'}
                  </button>
                )}
              </div>
            </div>

            {/* Main Content - Statistics & Data */}
            <div className="lg:col-span-3 space-y-6">
              {/* Tabs */}
              <div className="bg-white rounded-xl shadow-lg p-2">
                <div className="flex space-x-2">
                  {[
                    { id: 'overview', label: 'Vue d\'ensemble', icon: BarChart3 },
                    { id: 'panels', label: 'Panels', icon: Layers },
                    { id: 'repeats', label: 'Répétitions', icon: Repeat },
                    { id: 'coorder', label: 'Co-Ordre', icon: Network }
                  ].map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      onClick={() => setActiveTab(id as any)}
                      className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-lg font-medium transition-all ${
                        activeTab === id
                          ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab Content */}
              {activeTab === 'overview' && (
                <>
              {/* Stats Cards */}
              {stats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-cyan-500">
                    <Hash className="w-8 h-8 text-cyan-500 mb-2" />
                    <p className="text-3xl font-bold text-gray-800">{stats.total_rows.toLocaleString()}</p>
                    <p className="text-sm text-gray-600">Total de Résultats</p>
                  </div>

                  <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
                    <Users className="w-8 h-8 text-blue-500 mb-2" />
                    <p className="text-3xl font-bold text-gray-800">{stats.unique_patients.toLocaleString()}</p>
                    <p className="text-sm text-gray-600">Patients Uniques</p>
                  </div>

                  <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
                    <TestTube className="w-8 h-8 text-green-500 mb-2" />
                    <p className="text-3xl font-bold text-gray-800">{stats.unique_tests.toLocaleString()}</p>
                    <p className="text-sm text-gray-600">Tests Uniques</p>
                  </div>

                  <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-purple-500">
                    <Calendar className="w-8 h-8 text-purple-500 mb-2" />
                    <p className="text-sm font-bold text-gray-800">
                      {stats.date_range.min && new Date(stats.date_range.min).toLocaleDateString('fr-FR')}
                    </p>
                    <p className="text-xs text-gray-500">au</p>
                    <p className="text-sm font-bold text-gray-800">
                      {stats.date_range.max && new Date(stats.date_range.max).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>
              )}

              {/* Demographics */}
              {stats && (
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-white rounded-xl shadow-xl p-6">
                    <h3 className="text-lg font-bold mb-4 text-gray-800">Distribution par Sexe</h3>
                    <div className="space-y-3">
                      {Object.entries(stats.sex_distribution).map(([sex, count]) => (
                        <div key={sex}>
                          <div className="flex justify-between mb-1">
                            <span className="text-gray-700 font-medium">{sex}</span>
                            <span className="text-gray-600">
                              {count} ({((count / stats.total_rows) * 100).toFixed(1)}%)
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-gradient-to-r from-cyan-500 to-blue-600 h-2 rounded-full"
                              style={{ width: `${(count / stats.total_rows) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-xl p-6">
                    <h3 className="text-lg font-bold mb-4 text-gray-800">Statistiques d'Âge</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Moyenne:</span>
                        <span className="font-semibold text-gray-800">
                          {stats.age_stats.mean.toFixed(1)} ans
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Écart-type:</span>
                        <span className="font-semibold text-gray-800">
                          {stats.age_stats.std.toFixed(1)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Min - Max:</span>
                        <span className="font-semibold text-gray-800">
                          {stats.age_stats.min} - {stats.age_stats.max} ans
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Data Table */}
              <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-cyan-50 to-blue-50">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-gray-800">
                      Données Filtrées ({filteredData.length.toLocaleString()} résultats)
                    </h3>
                    {filteredData.length !== allData.length && (
                      <span className="text-sm text-cyan-600 font-medium">
                        {filteredData.length} / {allData.length} lignes
                      </span>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        {COLUMNS.map((col) => (
                          <th
                            key={col}
                            className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {currentData.map((row, idx) => (
                        <tr key={idx} className="hover:bg-cyan-50 transition-colors">
                          {COLUMNS.map((col) => (
                            <td
                              key={col}
                              className="px-6 py-4 whitespace-nowrap text-sm text-gray-700"
                            >
                              {row[col] !== null && row[col] !== undefined
                                ? String(row[col])
                                : '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                    <p className="text-sm text-gray-600">
                      Affichage de {indexOfFirstItem + 1} à {Math.min(indexOfLastItem, filteredData.length)} sur {filteredData.length.toLocaleString()} résultats
                    </p>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                      >
                        Précédent
                      </button>
                      <span className="px-4 py-2 text-sm text-gray-700">
                        Page {currentPage} / {totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                      >
                        Suivant
                      </button>
                    </div>
                  </div>
                )}
              </div>
              </>
              )}

              {/* Panels Tab */}
              {activeTab === 'panels' && (
                <div className="space-y-6">
                  {loadingTab ? (
                    <div className="flex items-center justify-center py-20">
                      <Loader2 className="w-16 h-16 text-cyan-500 animate-spin" />
                    </div>
                  ) : panelsData?.analysis ? (
                    <>
                      <div className="grid md:grid-cols-3 gap-4">
                        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-cyan-500">
                          <p className="text-3xl font-bold text-gray-800">{panelsData.analysis.total_panels?.toLocaleString() || 0}</p>
                          <p className="text-sm text-gray-600">Total Panels</p>
                        </div>
                        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
                          <p className="text-3xl font-bold text-gray-800">{panelsData.analysis.avg_tests_per_panel?.toFixed(1) || 0}</p>
                          <p className="text-sm text-gray-600">Tests Moyens/Panel</p>
                        </div>
                        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
                          <p className="text-3xl font-bold text-gray-800">{panelsData.analysis.max_tests_per_panel || 0}</p>
                          <p className="text-sm text-gray-600">Max Tests/Panel</p>
                        </div>
                      </div>

                      {/* Unique Tests Per Day */}
                      {panelsData.analysis.unique_tests_per_day && (
                        <div className="bg-white rounded-xl shadow-xl p-6">
                          <h3 className="text-xl font-bold mb-4 text-gray-800">Tests Uniques par Jour</h3>
                          <div className="grid md:grid-cols-2 gap-6 mb-6">
                            <div>
                              <h4 className="text-sm font-semibold text-gray-600 mb-3">Globaux (tous patients)</h4>
                              <div className="space-y-2">
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Moyenne:</span>
                                  <span className="font-semibold text-gray-800">
                                    {panelsData.analysis.unique_tests_per_day.global_by_date?.avg_unique_tests_per_day?.toFixed(1) || 0}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Médiane:</span>
                                  <span className="font-semibold text-gray-800">
                                    {panelsData.analysis.unique_tests_per_day.global_by_date?.median_unique_tests_per_day?.toFixed(1) || 0}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Min - Max:</span>
                                  <span className="font-semibold text-gray-800">
                                    {panelsData.analysis.unique_tests_per_day.global_by_date?.min_unique_tests_per_day || 0} - {panelsData.analysis.unique_tests_per_day.global_by_date?.max_unique_tests_per_day || 0}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div>
                              <h4 className="text-sm font-semibold text-gray-600 mb-3">Par Patient-Jour</h4>
                              <div className="space-y-2">
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Moyenne:</span>
                                  <span className="font-semibold text-gray-800">
                                    {panelsData.analysis.unique_tests_per_day.per_patient_day?.avg_unique_tests?.toFixed(1) || 0}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Médiane:</span>
                                  <span className="font-semibold text-gray-800">
                                    {panelsData.analysis.unique_tests_per_day.per_patient_day?.median_unique_tests?.toFixed(1) || 0}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Min - Max:</span>
                                  <span className="font-semibold text-gray-800">
                                    {panelsData.analysis.unique_tests_per_day.per_patient_day?.min_unique_tests || 0} - {panelsData.analysis.unique_tests_per_day.per_patient_day?.max_unique_tests || 0}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                          {panelsData.analysis.unique_tests_per_day.top_days_unique_tests && panelsData.analysis.unique_tests_per_day.top_days_unique_tests.length > 0 && (
                            <div>
                              <h4 className="text-sm font-semibold text-gray-600 mb-3">Top 10 Jours avec le Plus de Tests Uniques</h4>
                              <div className="space-y-2 max-h-48 overflow-y-auto">
                                {panelsData.analysis.unique_tests_per_day.top_days_unique_tests.map((day: any, idx: number) => (
                                  <div key={idx} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                                    <span className="text-sm text-gray-700">{new Date(day.date).toLocaleDateString('fr-FR')}</span>
                                    <span className="text-sm font-semibold text-cyan-600">{day.unique_tests_count} tests uniques</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {panelsData.analysis.most_common_panels && panelsData.analysis.most_common_panels.length > 0 && (
                        <div className="bg-white rounded-xl shadow-xl p-6">
                          <h3 className="text-xl font-bold mb-4 text-gray-800">Panels les Plus Fréquents</h3>
                          <div className="space-y-3 max-h-96 overflow-y-auto">
                            {panelsData.analysis.most_common_panels.map((panel: any, idx: number) => (
                              <div key={idx} className="p-4 bg-gray-50 rounded-lg">
                                <div className="flex justify-between items-start mb-2">
                                  <span className="font-semibold text-gray-800">{panel.count} occurrences</span>
                                  <span className="text-sm text-gray-600">{panel.test_count} tests</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {panel.tests.map((test: string, tIdx: number) => (
                                    <span key={tIdx} className="px-3 py-1 bg-cyan-100 text-cyan-800 rounded-full text-sm">
                                      {test}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="bg-white rounded-xl shadow-lg p-6 text-center text-gray-500">
                      Aucune donnée de panels disponible
                    </div>
                  )}
                </div>
              )}

              {/* Repeats Tab */}
              {activeTab === 'repeats' && (
                <div className="space-y-6">
                  {loadingTab ? (
                    <div className="flex items-center justify-center py-20">
                      <Loader2 className="w-16 h-16 text-cyan-500 animate-spin" />
                    </div>
                  ) : repeatsData?.analysis ? (
                    <>
                      <div className="grid md:grid-cols-4 gap-4">
                        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-cyan-500">
                          <p className="text-3xl font-bold text-gray-800">{repeatsData.analysis.total_patients?.toLocaleString() || 0}</p>
                          <p className="text-sm text-gray-600">Total Patients</p>
                        </div>
                        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
                          <p className="text-3xl font-bold text-gray-800">{repeatsData.analysis.patients_with_repeats?.toLocaleString() || 0}</p>
                          <p className="text-sm text-gray-600">Avec Répétitions</p>
                        </div>
                        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-green-500">
                          <p className="text-3xl font-bold text-gray-800">
                            {repeatsData.analysis.patients_with_repeats_pct?.toFixed(1) || 0}%
                          </p>
                          <p className="text-sm text-gray-600">% Avec Répétitions</p>
                        </div>
                        <div className="bg-white rounded-xl shadow-lg p-6 border-l-4 border-purple-500">
                          <p className="text-3xl font-bold text-gray-800">
                            {repeatsData.analysis.avg_repeats_per_patient?.toFixed(1) || 0}
                          </p>
                          <p className="text-sm text-gray-600">Répétitions Moyennes</p>
                        </div>
                      </div>

                      {repeatsData.analysis.most_repeated_tests && repeatsData.analysis.most_repeated_tests.length > 0 && (
                        <div className="bg-white rounded-xl shadow-xl p-6">
                          <h3 className="text-xl font-bold mb-4 text-gray-800">Tests les Plus Répétés</h3>
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Test</th>
                                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Patients</th>
                                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Répétitions Moy.</th>
                                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Max Répétitions</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {repeatsData.analysis.most_repeated_tests.map((test: any, idx: number) => (
                                  <tr key={idx} className="hover:bg-cyan-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{test.test}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{test.patients_with_repeats}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{test.avg_repeats_per_patient?.toFixed(1)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{test.max_repeats}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {repeatsData.analysis.interval_analysis && (
                        <div className="bg-white rounded-xl shadow-xl p-6">
                          <h3 className="text-xl font-bold mb-4 text-gray-800">Analyse des Intervalles</h3>
                          <div className="grid md:grid-cols-3 gap-4">
                            <div>
                              <p className="text-sm text-gray-600">Intervalle Moyen</p>
                              <p className="text-2xl font-bold text-gray-800">
                                {repeatsData.analysis.interval_analysis.avg_interval_days?.toFixed(1) || 'N/A'} jours
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">Intervalle Médian</p>
                              <p className="text-2xl font-bold text-gray-800">
                                {repeatsData.analysis.interval_analysis.median_interval_days?.toFixed(1) || 'N/A'} jours
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">Min - Max</p>
                              <p className="text-2xl font-bold text-gray-800">
                                {repeatsData.analysis.interval_analysis.min_interval_days || 'N/A'} - {repeatsData.analysis.interval_analysis.max_interval_days || 'N/A'} jours
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="bg-white rounded-xl shadow-lg p-6 text-center text-gray-500">
                      Aucune donnée de répétitions disponible
                    </div>
                  )}
                </div>
              )}

              {/* Co-Ordering Tab */}
              {activeTab === 'coorder' && (
                <div className="space-y-6">
                  {loadingTab ? (
                    <div className="flex items-center justify-center py-20">
                      <Loader2 className="w-16 h-16 text-cyan-500 animate-spin" />
                    </div>
                  ) : coorderData?.top_pairs ? (
                    <>
                      <div className="bg-white rounded-xl shadow-xl p-6">
                        <h3 className="text-xl font-bold mb-4 text-gray-800">Top Paires de Tests Co-Ordonnés</h3>
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                          {coorderData.top_pairs.map((pair: any, idx: number) => (
                            <div key={idx} className="p-4 bg-gray-50 rounded-lg">
                              <div className="flex justify-between items-center mb-2">
                                <span className="font-semibold text-gray-800">{pair.count} co-occurrences</span>
                                <span className="text-sm text-gray-600">{pair.support?.toFixed(2) || 0}% support</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className="px-3 py-1 bg-cyan-100 text-cyan-800 rounded-full text-sm font-medium">
                                  {pair.test1}
                                </span>
                                <span className="text-gray-400">+</span>
                                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                                  {pair.test2}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {coorderData.by_service && coorderData.by_service.length > 0 && (
                        <div className="bg-white rounded-xl shadow-xl p-6">
                          <h3 className="text-xl font-bold mb-4 text-gray-800">Analyse par Service</h3>
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Service</th>
                                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Total Tests</th>
                                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Total Panels</th>
                                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Tests/Panel Moy.</th>
                                  <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase">Tests Uniques</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {coorderData.by_service.map((service: any, idx: number) => (
                                  <tr key={idx} className="hover:bg-cyan-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{service.service || 'N/A'}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{service.total_tests}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{service.total_panels}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{service.avg_tests_per_panel?.toFixed(1)}</td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{service.unique_tests}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="bg-white rounded-xl shadow-lg p-6 text-center text-gray-500">
                      Aucune donnée de co-ordonnancement disponible
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

      {/* Empty State - No file_id */}
      {!loading && !file_id && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center max-w-md">
            <Database className="w-20 h-20 text-gray-300 mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-gray-700 mb-4">
              Aucun fichier sélectionné
            </h2>
            <p className="text-gray-500 mb-8">
              Veuillez d'abord uploader un fichier pour explorer vos données
            </p>
            <button
              onClick={() => router.push('/upload')}
              className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold rounded-full hover:scale-105 transition-transform shadow-lg"
            >
              Aller à l'Upload
            </button>
          </div>
        </div>
      )}
      </div>
      {/* Footer */}
  <footer className="bg-gradient-to-r from-cyan-500 to-blue-600 py-12 mt-12">
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