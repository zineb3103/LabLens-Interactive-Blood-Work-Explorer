# backend/app/services/llm_service.py
import os
import json
from typing import Dict, List, Any, Optional
import httpx
from datetime import datetime

from ..core.config import settings


class QwenCoderLLMService:
    """
    Service pour interagir avec Qwen 3 Coder 480B
    Optimisé pour la génération de requêtes SQL
    """
    
    def __init__(self):
        self.api_key = settings.QWEN_API_KEY or os.getenv("QWEN_API_KEY")
        self.base_url = (
            settings.QWEN_BASE_URL
            or os.getenv("QWEN_BASE_URL")
            or "https://models.github.ai/inference"
        )
        # Compatibilité avec l'ancien nom d'environnement `model`
        self.model = (
            settings.model
            or settings.LLM_MODEL
            or os.getenv("LLM_MODEL")
            or os.getenv("model")
            or "gpt-4.1"
        )
        self.timeout = 30.0
        
        # Schéma de la base de données
        self.schema_info = """
        Table: results
        Colonnes:
        - numorden (VARCHAR): Identifiant unique du patient
        - sexo (VARCHAR): Sexe du patient (M/F)
        - edad (INTEGER): Âge du patient
        - nombre (VARCHAR): Nom du test médical
        - textores (VARCHAR): Résultat du test (peut être numérique ou texte)
        - nombre2 (VARCHAR): Service médical (ex: Biochimie, Hematologie)
        - date (DATE): Date du test (format: YYYY-MM-DD)
        - file_id (VARCHAR): Identifiant du fichier uploadé
        """
    
    async def query_to_sql(
        self, 
        user_query: str, 
        file_id: str,
        conversation_history: Optional[List[Dict]] = None
    ) -> Dict[str, Any]:
        """
        Convertir une question en langage naturel en requête SQL
        
        Args:
            user_query: Question de l'utilisateur
            file_id: ID du fichier à interroger
            conversation_history: Historique de conversation (optionnel)
        
        Returns:
            Dict contenant sql_query, explanation, et metadata
        """
        try:
            if not self.api_key:
                raise ValueError(
                    "LLM non configuré : définissez QWEN_API_KEY dans votre fichier .env."
                )

            # Construire le prompt système
            system_prompt = self._build_system_prompt()
            
            # Construire le prompt utilisateur
            user_prompt = self._build_user_prompt(user_query, file_id)
            
            # Construire l'historique de conversation
            messages = self._build_messages(
                system_prompt, 
                user_prompt, 
                conversation_history
            )
            
            # Appel à l'API
            response = await self._call_api(messages)
            
            # Parser la réponse
            result = self._parse_response(response)
            
            return {
                "success": True,
                "sql_query": result["sql"],
                "explanation": result["explanation"],
                "thinking": result.get("thinking", ""),
                "confidence": result.get("confidence", 0.9)
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "sql_query": None,
                "explanation": "Erreur lors de la génération SQL"
            }
    
    def _build_system_prompt(self) -> str:
        """Construire le prompt système optimisé pour SQL et ce projet."""
        return f"""Tu es un expert en SQL spécialisé dans l'analyse de données médicales de laboratoire.
Tu écris des requêtes optimisées pour DuckDB sur une table unique appelée results.
Toutes tes explications doivent être en français, claires et pédagogiques.

Définitions métier importantes :
- Panel : ensemble des tests réalisés pour un même patient (numorden) le même jour (date).
- Cohorte : groupe de lignes filtrées par des critères cliniques (sexe, âge, service, type de test, etc.).

SCHÉMA DE LA BASE (TRÈS IMPORTANT) :
{self.schema_info}

CONTRAINTE GLOBALE :
- Toutes les requêtes doivent travailler UNIQUEMENT sur la table results.
- Tu ne dois jamais inventer de colonnes : tu dois utiliser exactement les noms listés dans le schéma.

RÈGLES CRITIQUES SQL :
1. Génère UNIQUEMENT des requêtes SQL valides pour DuckDB (pas de pseudo-code).
2. TOUJOURS inclure un filtre sur le fichier courant : WHERE file_id = 'XXX'
   - Si d'autres conditions WHERE existent, combine-les avec AND file_id = 'XXX'.
3. Ajoute toujours une clause LIMIT (par défaut LIMIT 20) pour les requêtes de sélection de lignes.
4. Pour compter des patients uniques, utilise COUNT(DISTINCT numorden).
5. Pour compter des tests uniques, utilise COUNT(DISTINCT nombre).
6. Pour analyser des services, utilise la colonne nombre2.
7. Pour les dates, utilise le format ISO : YYYY-MM-DD et la colonne date.
8. Nomme systématiquement les colonnes calculées via AS avec des alias explicites
   (ex : total_patients, total_tests, moyenne_age, nb_jours, cooccurrence_count, etc.).
9. Optimise les requêtes : évite les sous-requêtes inutiles et les SELECT * sur de gros volumes.

PANELS, RÉPÉTITIONS ET CO-ORDERING (QUAND PERTINENT) :
- Panels par patient-jour : groupe typiquement par (numorden, date) et agrège sur nombre.
- Tests répétés : compte le nombre de dates distinctes où un même (numorden, nombre) apparaît.
- Co-ordered tests (co-ordering) : pour un même numorden et une même date, trouve des paires de tests nombre
  souvent demandées ensemble, en agrégeant par service nombre2 si nécessaire.

GESTION DES FILTRES ET COHORTES :
- Pour filtrer par sexe, utilise sexo IN ('M', 'F') ou sexo = 'M' / 'F'.
- Pour filtrer par âge, utilise la colonne edad (INTEGER).
- Pour filtrer par service, utilise nombre2.
- Pour filtrer par type de test, utilise nombre et, si besoin, textores pour les valeurs de résultats.

FORMAT DE RÉPONSE (OBLIGATOIRE) :
Tu dois répondre STRICTEMENT avec un objet JSON (une seule ligne ou plusieurs lignes), de la forme :
{{
  "sql": "la requête SQL complète, avec les retours à la ligne échappés si nécessaire",
  "explanation": "explication en français de ce que fait la requête, en quelques phrases",
  "thinking": "ton raisonnement étape par étape (optionnel, en français)"
}}

CONTRAINTES FINALES :
- NE GÉNÈRE AUCUN TEXTE en dehors de cet objet JSON.
- Ne mets PAS de commentaires SQL dans le champ sql.
- Ne renvoie JAMAIS de code dans un autre langage que SQL dans le champ sql."""
    
    def _build_user_prompt(self, query: str, file_id: str) -> str:
        """Construire le prompt utilisateur"""
        return f"""Question de l'utilisateur: "{query}"

File ID à utiliser: {file_id}

Génère la requête SQL DuckDB correspondante."""
    
    def _build_messages(
        self, 
        system_prompt: str, 
        user_prompt: str,
        conversation_history: Optional[List[Dict]] = None
    ) -> List[Dict[str, str]]:
        """Construire la liste des messages pour l'API"""
        messages = [
            {"role": "system", "content": system_prompt}
        ]
        
        # Ajouter l'historique (max 5 derniers échanges)
        if conversation_history:
            for msg in conversation_history[-5:]:
                messages.append({
                    "role": msg["role"],
                    "content": msg["content"]
                })
        
        # Ajouter la question actuelle
        messages.append({
            "role": "user",
            "content": user_prompt
        })
        
        return messages
    
    async def _call_api(self, messages: List[Dict]) -> Dict:
        """Appeler l'API Qwen Coder"""
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": self.model,
                    "messages": messages,
                    "temperature": 0.1,  # Bas pour cohérence
                    "max_tokens": 1000,
                    "top_p": 0.95,
                    "response_format": {"type": "json_object"}  # Force JSON
                }
            )
            
            response.raise_for_status()
            return response.json()
    
    def _parse_response(self, api_response: Dict) -> Dict:
        """Parser la réponse de l'API"""
        try:
            content = api_response["choices"][0]["message"]["content"]
            
            # Parser le JSON
            result = json.loads(content)
            
            # Valider que les champs requis existent
            if "sql" not in result or "explanation" not in result:
                raise ValueError("Réponse invalide: champs manquants")
            
            return result
            
        except (json.JSONDecodeError, KeyError, IndexError) as e:
            raise ValueError(f"Erreur de parsing de la réponse: {e}")
    
    def validate_sql(self, sql: str, file_id: str) -> Dict[str, Any]:
        """
        Valider une requête SQL avant exécution
        
        Returns:
            Dict avec valid (bool) et errors (list)
        """
        errors = []
        
        # 1. Vérifier que file_id est présent
        if f"file_id = '{file_id}'" not in sql and f'file_id = "{file_id}"' not in sql:
            errors.append("La requête doit filtrer par file_id")
        
        # 2. Vérifier mots-clés dangereux
        dangerous = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'CREATE', 'TRUNCATE']
        sql_upper = sql.upper()
        for keyword in dangerous:
            if keyword in sql_upper:
                errors.append(f"Mot-clé interdit détecté: {keyword}")
        
        # 3. Vérifier que c'est bien un SELECT
        if not sql_upper.strip().startswith('SELECT'):
            errors.append("Seules les requêtes SELECT sont autorisées")
        
        # 4. Vérifier la présence d'un LIMIT
        #    S'il n'y en a pas, on l'ajoute automatiquement au lieu de bloquer.
        if 'LIMIT' not in sql_upper:
            cleaned = sql.rstrip().rstrip(';')
            sql = f"{cleaned} LIMIT 100"
        
        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "sql": sql
        }
