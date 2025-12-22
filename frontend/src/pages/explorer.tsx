import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import {
  Activity, Filter, Database, BarChart3, TrendingUp, Users,
  Plus, X, Play, Download, Save, Share2, Eye, EyeOff,
  Calendar, Hash, User, TestTube, FileText, Loader2, AlertCircle, MessageSquare,
  Layers, Repeat, Network, Bookmark, BookmarkCheck, Copy, Trash2
} from 'lucide-react';
import DistributionChart from '@/components/Charts/DistributionChart';
import HeatmapChart from '@/components/Charts/HeatmapChart';
import TimeTrendChart from '@/components/Charts/TimeTrendChart';

interface FilterCondition {
  id: string;
  column: string;
  operator: string;
  value: string;
}

interface SavedView {
  view_id: string;
  name: string;
  file_id: string;
  filters: { column: string; operator: string; value: string }[];
  description?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
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
  const { file_id, view_id } = router.query;

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
  const [coorderMatrix, setCoorderMatrix] = useState<any>(null);
  const [loadingTab, setLoadingTab] = useState(false);
  
  // Data for visualizations
  const [timeseriesData, setTimeseriesData] = useState<{x: string[], y: number[]} | null>(null);
  const [loadingVisualizations, setLoadingVisualizations] = useState(false);

  // States for saved views
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [loadingViews, setLoadingViews] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [viewName, setViewName] = useState('');
  const [viewDescription, setViewDescription] = useState('');
  const [savingView, setSavingView] = useState(false);
  const [showViewsList, setShowViewsList] = useState(false);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

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

  useEffect(() => {
    if (file_id) {
      loadVisualizationData();
    }
  }, [file_id, filters, filterMode, activeTab]);

  // Charger une vue sauvegardée depuis l'URL (partage)
  useEffect(() => {
    if (view_id && typeof view_id === 'string' && !loading && file_id) {
      loadViewFromId(view_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view_id, file_id]);

  // Charger les vues sauvegardées
  useEffect(() => {
    if (file_id) {
      loadSavedViews();
    }
  }, [file_id]);

  const loadVisualizationData = async () => {
    if (!file_id) return;
    
    setLoadingVisualizations(true);
    try {
      // Préparer les filtres pour l'API
      const filtersToSend = filterMode === 'manual' 
        ? filters.filter(f => f.value)
        : [];
      
      const filtersParam = filtersToSend.length > 0 
        ? `&filters=${encodeURIComponent(JSON.stringify(filtersToSend))}`
        : '';
      
      // Charger les données de série temporelle avec filtres
      const timeseriesResponse = await fetch(`http://localhost:8000/api/stats/${file_id}/timeseries?column=nombre&group_by=day${filtersParam}`);
      if (timeseriesResponse.ok) {
        const timeseriesResult = await timeseriesResponse.json();
        if (timeseriesResult.success && timeseriesResult.data) {
          setTimeseriesData(timeseriesResult.data);
        }
      }
      
      // Charger la matrice de co-occurrence avec filtres si on est dans l'onglet coorder
      if (activeTab === 'coorder') {
        const matrixResponse = await fetch(`http://localhost:8000/api/coorder/${file_id}/matrix${filtersParam ? '?' + filtersParam.substring(1) : ''}`);
        if (matrixResponse.ok) {
          const matrixData = await matrixResponse.json();
          setCoorderMatrix(matrixData);
        }
      }
    } catch (err: any) {
      console.error('Error loading visualization data:', err);
    } finally {
      setLoadingVisualizations(false);
    }
  };

  // Charger une vue sauvegardée depuis l'URL (partage)
  const loadViewFromId = async (viewId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`http://localhost:8000/api/views/${viewId}`);
      if (!response.ok) {
        throw new Error('Vue non trouvée');
      }
      const data = await response.json();
      if (data.success && data.view) {
        const view = data.view;
        
        // Naviguer vers le bon file_id si nécessaire
        if (view.file_id !== file_id) {
          router.push(`/explorer?file_id=${view.file_id}&view_id=${viewId}`);
          return;
        }
        
        // Convertir les filtres au format FilterCondition
        const loadedFilters: FilterCondition[] = view.filters.map((f: any, idx: number) => ({
          id: `loaded-${idx}-${Date.now()}`,
          column: f.column,
          operator: f.operator,
          value: f.value
        }));
        
        // Appliquer les filtres
        setFilters(loadedFilters);
        setFilterMode('manual');
        
        // Recharger les données avec les filtres
        await loadDataFromBackend();
      }
    } catch (err: any) {
      setError(`Erreur lors du chargement de la vue : ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Charger la liste des vues sauvegardées
  const loadSavedViews = async () => {
    if (!file_id) return;
    
    setLoadingViews(true);
    try {
      const response = await fetch(`http://localhost:8000/api/views?file_id=${file_id}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const sanitizedViews: SavedView[] = (data.views || []).map((view: any) => ({
            view_id: view.view_id,
            name: view.name,
            file_id: view.file_id,
            filters: Array.isArray(view.filters) ? view.filters : [],
            description: view.description ?? null,
            created_at: view.created_at ?? null,
            updated_at: view.updated_at ?? null
          }));
          setSavedViews(sanitizedViews);
        }
      }
    } catch (err: any) {
      console.error('Error loading views:', err);
    } finally {
      setLoadingViews(false);
    }
  };

  // Sauvegarder la vue actuelle
  const saveCurrentView = async () => {
    if (!file_id || !viewName.trim()) {
      setError('Veuillez entrer un nom pour la vue');
      return;
    }
    
    // Préparer les filtres à sauvegarder (uniquement ceux avec une valeur)
    const filtersToSave = filters.filter(f => f.value.trim());
    
    if (filtersToSave.length === 0) {
      setError('Aucun filtre à sauvegarder');
      return;
    }
    
    setSavingView(true);
    try {
      const response = await fetch('http://localhost:8000/api/views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: viewName.trim(),
          file_id: file_id,
          filters: filtersToSave.map(f => ({
            column: f.column,
            operator: f.operator,
            value: f.value
          })),
          description: viewDescription.trim() || null
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Erreur lors de la sauvegarde');
      }
      
      const data = await response.json();
      if (data.success) {
        // Réinitialiser le formulaire
        setViewName('');
        setViewDescription('');
        setShowSaveModal(false);
        
        // Recharger la liste des vues
        await loadSavedViews();
        
        // Afficher un message de succès
        alert('Vue sauvegardée avec succès !');
      }
    } catch (err: any) {
      setError(`Erreur lors de la sauvegarde : ${err.message}`);
    } finally {
      setSavingView(false);
    }
  };

  // Charger une vue sauvegardée
  const loadSavedView = async (viewId: string) => {
    try {
      setLoading(true);
      setError(null);
      console.log('Chargement de la vue:', viewId);
      
      const response = await fetch(`http://localhost:8000/api/views/${viewId}`);
      console.log('Réponse du serveur:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Erreur inconnue' }));
        throw new Error(errorData.detail || `Erreur ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Données reçues:', data);
      
      if (data.success && data.view) {
        const view: SavedView = {
          view_id: data.view.view_id,
          name: data.view.name,
          file_id: data.view.file_id,
          filters: Array.isArray(data.view.filters) ? data.view.filters : [],
          description: data.view.description ?? null,
          created_at: data.view.created_at ?? null,
          updated_at: data.view.updated_at ?? null
        };
        
        if (view.filters.length === 0) {
          throw new Error('Les filtres de la vue sont vides ou invalides');
        }
        
        // Naviguer automatiquement vers le bon fichier si besoin
        if (view.file_id !== file_id) {
          console.log('Changement de fichier nécessaire, redirection...');
          await router.push({
            pathname: '/explorer',
            query: { file_id: view.file_id, view_id: viewId }
          });
          setShowViewsList(false);
          return;
        }
        
        // Convertir les filtres
        const loadedFilters: FilterCondition[] = view.filters.map((f, idx: number) => ({
          id: `loaded-${idx}-${Date.now()}`,
          column: f.column || '',
          operator: f.operator || '=',
          value: f.value || ''
        }));
        
        console.log('Filtres chargés:', loadedFilters);
        
        // Appliquer les filtres
        setFilters(loadedFilters);
        setFilterMode('manual');
        
        // Mettre à jour l'URL pour refléter la vue active
        router.replace({
          pathname: '/explorer',
          query: { ...router.query, file_id: view.file_id, view_id: viewId }
        }, undefined, { shallow: true });
        
        // Recharger les données
        await loadDataFromBackend();
        
        // Fermer la liste des vues
        setShowViewsList(false);
        
        console.log('Vue chargée avec succès');
      } else {
        throw new Error('Format de réponse invalide');
      }
    } catch (err: any) {
      console.error('Erreur lors du chargement de la vue:', err);
      setError(`Erreur lors du chargement : ${err.message}`);
      alert(`Erreur lors du chargement de la vue : ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Supprimer une vue
  const deleteView = async (viewId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette vue ?')) {
      return;
    }
    
    try {
      setError(null);
      console.log('Suppression de la vue:', viewId);
      
      const response = await fetch(`http://localhost:8000/api/views/${viewId}`, {
        method: 'DELETE'
      });
      
      console.log('Réponse suppression:', response.status, response.statusText);
      
      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        console.log('Vue supprimée:', data);
        
        // Recharger la liste
        await loadSavedViews();
        
        alert('Vue supprimée avec succès');
      } else {
        const errorData = await response.json().catch(() => ({ detail: 'Erreur inconnue' }));
        throw new Error(errorData.detail || `Erreur ${response.status}: ${response.statusText}`);
      }
    } catch (err: any) {
      console.error('Erreur lors de la suppression:', err);
      setError(`Erreur lors de la suppression : ${err.message}`);
      alert(`Erreur lors de la suppression : ${err.message}`);
    }
  };

  // Partager une vue (copier le lien)
  const shareView = async (viewId: string) => {
    try {
      setError(null);
      console.log('Partage de la vue:', viewId);
      
      const response = await fetch(`http://localhost:8000/api/views/${viewId}/share`);
      console.log('Réponse partage:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Erreur inconnue' }));
        throw new Error(errorData.detail || `Erreur ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Données de partage:', data);
      
      if (data.success && data.share_link) {
        // Copier dans le presse-papier
        try {
          await navigator.clipboard.writeText(data.share_link);
          setCopiedLink(viewId);
          
          // Réinitialiser après 2 secondes
          setTimeout(() => setCopiedLink(null), 2000);
          
          alert(`Lien copié dans le presse-papier !\n${data.share_link}`);
        } catch (clipboardError: any) {
          // Si la copie échoue, afficher le lien
          alert(`Lien de partage :\n${data.share_link}`);
        }
      } else {
        throw new Error('Format de réponse invalide');
      }
    } catch (err: any) {
      console.error('Erreur lors du partage:', err);
      setError(`Erreur lors du partage : ${err.message}`);
      alert(`Erreur lors du partage : ${err.message}`);
    }
  };

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
        // Charger aussi la matrice pour la heatmap avec filtres
        const filtersToSend = filterMode === 'manual' 
          ? filters.filter(f => f.value)
          : [];
        const filtersParam = filtersToSend.length > 0 
          ? `?filters=${encodeURIComponent(JSON.stringify(filtersToSend))}`
          : '';
        const matrixResponse = await fetch(`http://localhost:8000/api/coorder/${file_id}/matrix${filtersParam}`);
        if (matrixResponse.ok) {
          const matrixData = await matrixResponse.json();
          setCoorderMatrix(matrixData);
        }
      }
    } catch (err: any) {
      console.error('Error loading tab data:', err);
      // Ne pas afficher d'erreur pour les onglets, juste logger
      // L'erreur principale sera gérée par loadDataFromBackend
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
      // Charger les données et les statistiques (gérer les erreurs indépendamment)
      let dataResponse, statsResponse;
      
      try {
        dataResponse = await fetch(`http://localhost:8000/api/files/${file_id}/data?limit=500000`);
      } catch (fetchError: any) {
        throw new Error(`Impossible de se connecter au serveur: ${fetchError.message}`);
      }

      if (!dataResponse.ok) {
        const errorData = await dataResponse.json().catch(() => ({}));
        throw new Error(errorData.detail || `Erreur ${dataResponse.status}: Fichier non trouvé`);
      }

      const dataResult = await dataResponse.json();
      
      // Charger les statistiques si disponible (ne pas faire échouer si ça échoue)
      let backendStats = null;
      try {
        statsResponse = await fetch(`http://localhost:8000/api/stats/summary`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file_id })
        });
        
        if (statsResponse.ok) {
          backendStats = await statsResponse.json();
        } else {
          console.warn('Stats endpoint returned error:', statsResponse.status);
        }
      } catch (statsError: any) {
        console.warn('Could not load backend stats (non bloquant):', statsError);
        // On continue sans les stats du backend
      }

      if (dataResult.data && dataResult.data.length > 0) {
        setAllData(dataResult.data);
        setFilteredData(dataResult.data);
        
        // Utiliser les statistiques du backend si disponibles, sinon calculer localement
        if (backendStats && backendStats.success) {
          // Convertir les statistiques du backend au format attendu par le frontend
          const summary = backendStats.summary;
          const total_rows = backendStats.total_rows; // Le vrai total depuis le backend
          
          // Extraire les statistiques depuis le summary du backend
          const numericStats = summary.numeric_stats || {};
          const categoricalStats = summary.categorical_stats || {};
          
          // Statistiques d'âge
          const edadStats = numericStats.edad || {};
          const age_stats = {
            mean: edadStats.mean || 0,
            std: edadStats.std || 0,
            min: edadStats.min || 0,
            max: edadStats.max || 0
          };
          
          // Distribution du sexe
          const sexoDist = categoricalStats.sexo?.distribution || {};
          const sex_distribution: { [key: string]: number } = {};
          Object.entries(sexoDist).forEach(([key, value]) => {
            sex_distribution[key] = typeof value === 'number' ? value : 0;
          });
          
          // Plage de dates (depuis les données chargées)
          const dates = dataResult.data
            .map((row: any) => row.date)
            .filter((d: any) => d)
            .map((d: any) => new Date(d))
            .sort((a: Date, b: Date) => a.getTime() - b.getTime());
          
          const date_range = {
            min: dates.length > 0 ? dates[0].toISOString().split('T')[0] : '',
            max: dates.length > 0 ? dates[dates.length - 1].toISOString().split('T')[0] : ''
          };
          
          // Unique patients et tests - utiliser les données chargées (échantillon)
          // Note: Pour les vrais totaux, on devrait faire des requêtes SQL COUNT(DISTINCT ...)
          // mais pour l'instant on utilise l'échantillon pour l'affichage
          const unique_patients = new Set(dataResult.data.map((row: any) => row.numorden)).size;
          const unique_tests = new Set(dataResult.data.map((row: any) => row.nombre)).size;
          
          setStats({
            total_rows, // Le vrai total depuis le backend
            unique_patients,
            unique_tests,
            date_range,
            age_stats,
            sex_distribution
          });
        } else {
          // Fallback: calculer localement sur l'échantillon
          computeStatistics(dataResult.data);
          // Mais utiliser le total_rows du backend si disponible
          if (dataResult.total_rows) {
            setStats(prev => prev ? { ...prev, total_rows: dataResult.total_rows } : null);
          }
        }
      } else {
        setError('Aucune donnée disponible');
      }
    } catch (err: any) {
      console.error('Error loading data:', err);
      
      // Gérer spécifiquement les erreurs de réseau
      if (err.message === 'Failed to fetch' || err.name === 'TypeError' || err.message?.includes('fetch')) {
        setError('Impossible de se connecter au serveur. Vérifiez que le backend est en cours d\'exécution sur http://localhost:8000');
      } else if (err.message?.includes('404') || err.message?.includes('non trouvé')) {
        setError('Fichier non trouvé. Le file_id est peut-être invalide.');
      } else {
        setError(err.message || 'Erreur lors du chargement des données');
      }
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

    // Sex distribution (calculé avant pour être disponible dans tous les cas)
    const sex_distribution: { [key: string]: number } = {};
    data.forEach(row => {
      const sex = row.sexo || 'Unknown';
      sex_distribution[sex] = (sex_distribution[sex] || 0) + 1;
    });

    // Age statistics
    const ages = data
      .map(row => parseInt(row.edad))
      .filter(age => !isNaN(age));

    if (ages.length === 0) {
      setStats({
        total_rows,
        unique_patients,
        unique_tests,
        date_range,
        age_stats: { mean: 0, std: 0, min: 0, max: 0 },
        sex_distribution
      });
      return;
    }

    const age_mean = ages.reduce((a, b) => a + b, 0) / ages.length;
    const age_variance = ages.reduce((sum, age) => sum + Math.pow(age - age_mean, 2), 0) / ages.length;
    const age_std = Math.sqrt(age_variance);

    // Utiliser reduce au lieu de Math.min/max pour éviter le stack overflow avec de grands tableaux
    const age_min = ages.reduce((min, age) => age < min ? age : min, ages[0]);
    const age_max = ages.reduce((max, age) => age > max ? age : max, ages[0]);

    const age_stats = {
      mean: age_mean,
      std: age_std,
      min: age_min,
      max: age_max
    };

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

  const exportData = async (format: 'csv' | 'xlsx') => {
    if (!file_id) {
      alert('Aucun fichier sélectionné');
      return;
    }

    try {
      // Construire l'URL avec les paramètres
      const params = new URLSearchParams({
        file_id: file_id as string,
        format: format === 'xlsx' ? 'xlsx' : 'csv'
      });

      // Préparer les filtres ou la requête SQL selon le mode
      if (filterMode === 'sql') {
        if (!sqlQuery.trim()) {
          alert('Veuillez entrer une requête SQL pour exporter les données');
          return;
        }
        // Ajouter la requête SQL
        params.append('sql_query', sqlQuery.trim());
      } else {
        // Mode manuel : ajouter les filtres si présents
        const filtersToExport = filters.filter(f => f.value);
        if (filtersToExport.length > 0) {
          params.append('filters', JSON.stringify(filtersToExport));
        }
      }

      // Appeler l'endpoint d'export
      const response = await fetch(`http://localhost:8000/api/subset/export?${params.toString()}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Erreur lors de l\'export' }));
        throw new Error(errorData.detail || `Erreur ${response.status}`);
      }

      // Télécharger le fichier
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Extraire le nom de fichier depuis les headers ou utiliser un nom par défaut
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `lablens_export_${file_id}_${new Date().toISOString().split('T')[0]}.${format === 'xlsx' ? 'xlsx' : 'csv'}`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Error exporting data:', err);
      alert(`Erreur lors de l'export: ${err.message}`);
    }
  };

  // Calculer les données paginées
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentData = filteredData.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-cyan-50 flex flex-col">
      {/* Header (aligné sur index.tsx) */}
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
        onClick={() => router.push(file_id ? `/assistant?file_id=${file_id}` : '/assistant')}
        className="fixed bottom-8 right-8 w-16 h-16 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-cyan-500/50 z-50"
      >
        <MessageSquare className="w-7 h-7 text-white" />
      </button>
      <div className="flex-1 max-w-screen-3xl mx-auto w-full px-4 sm:px-6 lg:px-12 xl:px-16 py-8">
        {/* Title */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-2 bg-gradient-to-r from-cyan-500 to-blue-600 bg-clip-text text-transparent">
            Explorateur de Données
          </h1>
          <p className="text-gray-600 text-base sm:text-lg md:text-xl">
            Filtrez, analysez et visualisez vos données de laboratoire
          </p>
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

                {/* Boutons Sauvegarder et Liste des vues */}
                {filterMode === 'manual' && (
                  <div className="flex flex-col gap-2 mb-6">
                    <button
                      onClick={() => setShowSaveModal(true)}
                      disabled={filters.filter(f => f.value).length === 0}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      <Save className="w-4 h-4" />
                      <span>Sauvegarder la vue</span>
                    </button>
                    
                    <button
                      onClick={() => setShowViewsList(!showViewsList)}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
                    >
                      <Bookmark className="w-4 h-4" />
                      <span>Mes vues ({savedViews.length})</span>
                    </button>
                  </div>
                )}

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
                    onClick={() => exportData('csv')}
                    className="w-full py-2 border-2 border-cyan-500 text-cyan-600 font-medium rounded-lg hover:bg-cyan-50 transition-colors flex items-center justify-center space-x-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Exporter CSV</span>
                  </button>
                  <button
                    onClick={() => exportData('xlsx')}
                    className="w-full py-2 border-2 border-blue-500 text-blue-600 font-medium rounded-lg hover:bg-blue-50 transition-colors flex items-center justify-center space-x-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Exporter Excel</span>
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
                    {allData.length < stats.total_rows && (
                      <p className="text-xs text-gray-400 mt-1">
                        ({allData.length.toLocaleString()} affichées)
                      </p>
                    )}
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

              {/* Visualizations */}
              {stats && (
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Distribution d'âge - Histogramme */}
                  <div className="bg-white rounded-xl shadow-xl p-6">
                    <h3 className="text-lg font-bold mb-4 text-gray-800">Distribution d'Âge</h3>
                    <div className="h-64">
                      <DistributionChart
                        data={filteredData.map(row => row.edad).filter(edad => edad != null && !isNaN(edad))}
                        title=""
                        xLabel="Âge (ans)"
                        yLabel="Fréquence"
                        bins={20}
                        color="#06b6d4"
                      />
                    </div>
                  </div>

                  {/* Série temporelle */}
                  <div className="bg-white rounded-xl shadow-xl p-6">
                    <h3 className="text-lg font-bold mb-4 text-gray-800">Évolution des Tests dans le Temps</h3>
                    <div className="h-64">
                      {loadingVisualizations ? (
                        <div className="flex items-center justify-center h-full">
                          <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
                        </div>
                      ) : timeseriesData ? (
                        <TimeTrendChart
                          x={timeseriesData.x}
                          y={timeseriesData.y}
                          title=""
                          xLabel="Date"
                          yLabel="Nombre de tests"
                          color="#06b6d4"
                          mode="lines+markers"
                          seriesName="Tests"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-500">
                          Aucune donnée temporelle disponible
                        </div>
                      )}
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
                    <div>
                      <p className="text-sm text-gray-600">
                        Affichage de {indexOfFirstItem + 1} à {Math.min(indexOfLastItem, filteredData.length)} sur {filteredData.length.toLocaleString()} résultats
                      </p>
                      {stats && stats.total_rows > filteredData.length && filters.length === 0 && filterMode === 'manual' && !sqlQuery.trim() && (
                        <p className="text-xs text-gray-400 mt-1">
                          Total réel: {stats.total_rows.toLocaleString()} lignes (échantillon de {filteredData.length.toLocaleString()} chargées)
                        </p>
                      )}
                    </div>
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

                      {/* Heatmap de co-occurrence */}
                      {coorderMatrix?.success && coorderMatrix?.matrix && (
                        <div className="bg-white rounded-xl shadow-xl p-6">
                          <h3 className="text-xl font-bold mb-4 text-gray-800">Matrice de Co-occurrence</h3>
                          <div className="h-96">
                            <HeatmapChart
                              data={coorderMatrix.matrix}
                              xLabels={coorderMatrix.test_names}
                              yLabels={coorderMatrix.test_names}
                              title=""
                              xLabel="Test 1"
                              yLabel="Test 2"
                              colorscale="Blues"
                            />
                          </div>
                        </div>
                      )}

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

      {/* Modal de sauvegarde */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">Sauvegarder la vue</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nom de la vue *</label>
                <input
                  type="text"
                  value={viewName}
                  onChange={(e) => setViewName(e.target.value)}
                  placeholder="Ex: Femmes > 40 ans"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Description (optionnel)</label>
                <textarea
                  value={viewDescription}
                  onChange={(e) => setViewDescription(e.target.value)}
                  placeholder="Description de cette cohorte..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div className="text-sm text-gray-600">
                <p>Filtres à sauvegarder : {filters.filter(f => f.value).length}</p>
              </div>
            </div>
            
            <div className="flex gap-2 mt-6">
              <button
                onClick={saveCurrentView}
                disabled={savingView || !viewName.trim()}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingView ? 'Sauvegarde...' : 'Sauvegarder'}
              </button>
              <button
                onClick={() => {
                  setShowSaveModal(false);
                  setViewName('');
                  setViewDescription('');
                }}
                className="flex-1 px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Liste des vues sauvegardées */}
      {showViewsList && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Mes vues sauvegardées</h3>
              <button
                onClick={() => setShowViewsList(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {loadingViews ? (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
                <p className="mt-2 text-gray-600">Chargement...</p>
              </div>
            ) : savedViews.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Bookmark className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Aucune vue sauvegardée</p>
              </div>
            ) : (
              <div className="space-y-3">
                {savedViews.map((view) => (
                  <div
                    key={view.view_id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-semibold text-lg">{view.name}</h4>
                        {view.description && (
                          <p className="text-sm text-gray-600 mt-1">{view.description}</p>
                        )}
                        <div className="mt-2 text-xs text-gray-500">
                          <p>
                            Créée le :{' '}
                            {view.created_at
                              ? new Date(view.created_at).toLocaleDateString('fr-FR')
                              : 'Date inconnue'}
                          </p>
                          <p>Filtres : {view.filters?.length || 0}</p>
                        </div>
                      </div>
                      
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => loadSavedView(view.view_id)}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                          title="Charger cette vue"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => shareView(view.view_id)}
                          className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors"
                          title="Partager"
                        >
                          {copiedLink === view.view_id ? (
                            <BookmarkCheck className="w-4 h-4" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => deleteView(view.view_id)}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      
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
            <div className="flex items-center justify-center space-x-6 text-sm sm:text-base md:text-lg text-white/80">
              <span>Farah</span>
              <span>•</span>
              <span>Zineb</span>
              <span>•</span>
              <span>Toufali</span>
              <span>•</span>
              <span>Oumaima</span>
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