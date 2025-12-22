
# ============================================================
# backend/app/api/llm.py (VERSION MISE À JOUR)
# ============================================================

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from sqlalchemy import text
from sqlmodel import Session

from ..db.base import engine
from ..services.llm_service import QwenCoderLLMService

router = APIRouter()
llm_service = QwenCoderLLMService()


class ConversationMessage(BaseModel):
    role: str
    content: str


class LLMQueryRequest(BaseModel):
    file_id: str
    query: str
    conversation_history: Optional[List[ConversationMessage]] = []


@router.post("/llm/query")
async def process_llm_query(request: LLMQueryRequest):
    """
    Traiter une requête en langage naturel avec Qwen 3 Coder 480B
    """
    try:
        # Appel au LLM pour générer le SQL
        llm_result = await llm_service.query_to_sql(
            user_query=request.query,
            file_id=request.file_id,
            conversation_history=[msg.dict() for msg in request.conversation_history]
        )
        
        if not llm_result["success"]:
            return {
                "success": False,
                "response": "Je n'ai pas pu générer une requête SQL pour cette question.",
                "error": llm_result.get("error")
            }
        
        sql_query = llm_result["sql_query"]
        explanation = llm_result["explanation"]
        
        # Valider le SQL
        validation = llm_service.validate_sql(sql_query, request.file_id)
        
        if not validation["valid"]:
            # Construire un message humain lisible avec les causes
            errors = validation.get("errors", [])
            if errors:
                reasons = " ; ".join(errors)
                response_msg = f"La requête générée n'est pas sécurisée : {reasons}."
            else:
                response_msg = "La requête générée n'est pas sécurisée."

            return {
                "success": False,
                "response": response_msg,
                "sql_query": sql_query,
                "explanation": explanation,
                "errors": errors,
            }
        
        try:
            with Session(engine) as session:
                result = session.exec(text(sql_query))
                data = [dict(row._mapping) for row in result]
            
            # Générer une réponse naturelle
            response = generate_natural_response(
                request.query,
                data,
                explanation
            )
            
            return {
                "success": True,
                "response": response,
                "sql_query": sql_query,
                "explanation": explanation,
                "data": data[:10],  # Limiter à 10 lignes
                "total_rows": len(data),
                "thinking": llm_result.get("thinking", "")
            }
            
        except Exception as e:
            return {
                "success": False,
                "response": f"Erreur lors de l'exécution de la requête.",
                "sql_query": sql_query,
                "explanation": explanation,
                "error": str(e)
            }
        
    except Exception as e:
        return {
            "success": False,
            "response": "Une erreur s'est produite. Veuillez réessayer.",
            "error": str(e)
        }


def generate_natural_response(query: str, data: List[Dict], explanation: str) -> str:
    """
    Générer une réponse en langage naturel basée sur les résultats
    """
    if not data:
        return "❌ Aucun résultat trouvé pour cette requête."
    
    # Réponse générique avec le nombre de résultats
    response = f"✅ {explanation}\n\n"
    response += f"**{len(data)} résultat(s) trouvé(s)**"
    
    if len(data) > 10:
        response += f" (affichage des 10 premiers)"
    
    return response

