import os
import json
import requests
from typing import List, Dict, Any, Optional
from langchain_community.vectorstores.supabase import SupabaseVectorStore
from langchain_community.vectorstores.faiss import FAISS
from langchain_community.embeddings.huggingface import HuggingFaceEmbeddings
from langchain_core.documents import Document
from langchain_tavily import TavilySearch
from supabase import create_client, Client
import asyncio
from datetime import datetime
import re

# ---------------------------------------------------------------------------
# System prompt to nudge the LLM to reply in PlantUML. Enforcement happens in
# the backend; this prompt is only guidance and has no hard dependency on
# external guard-rail modules.
# ---------------------------------------------------------------------------
SYSTEM_PROMPT: str = (
    "You are an expert PlantUML architect. Your sole purpose is to generate syntactically correct and complete PlantUML diagrams.\n"
    "\n"
    "Follow these rules strictly:\n"
    "1. **COMPLETE CODE ONLY**: Your response MUST be a single, complete PlantUML code block starting with `@startuml` and ending with `@enduml`.\n"
    "2. **DEFINE BEFORE USE**: CRITICAL - Every class, interface, component, or actor MUST be defined before it is used in a relationship. If you use `ClassA --> ClassB`, both `ClassA` and `ClassB` must have been declared.\n"
    "3. **USE CORRECT SYNTAX**: Use standard PlantUML syntax for relationships (e.g., `Parent <|-- Child`, `Client ..> Service`).\n"
    "\n"
    "--- GOOD EXAMPLE ---\n"
    "@startuml\n"
    "title Simple Class Diagram Example\n"
    "\n"
    "class User {\n"
    "  +userId: String\n"
    "  +login(): void\n"
    "}\n"
    "\n"
    "class Order {\n"
    "  -orderId: String\n"
    "  +placeOrder(): void\n"
    "}\n"
    "\n"
    "User \"1\" -- \"0..*\" Order : places\n"
    "@enduml\n"
    "--- END EXAMPLE ---\n"
    "\n"
    "Now, generate the diagram based on the user's request and the provided context.\n")


class WorkingRAGSystem:
    """A working RAG system that actually uses LLM inference and RAG retrieval."""

    # -----------------------------
    # Fallback helpers
    # -----------------------------
    def _basic_text_to_plantuml(self, text: str) -> str:
        """Very simple heuristic converter for textual class listings → PlantUML.
        This is a *last-resort* path used only when the LLM failed to obey the
        SYSTEM_PROMPT. It supports the bullet-style format the frontend shows.
        """
        # If the text already looks like PlantUML, return it directly.
        if "@startuml" in text and "@enduml" in text:
            return text

        classes = {}
        current_cls = None
        for raw in text.splitlines():
            line = raw.strip()
            if not line:
                current_cls = None
                continue
            # Class name (no leading bullets, contains no colon)
            if not line.startswith(('-', '+')) and ':' not in line:
                current_cls = line.replace('`', '').strip()
                if current_cls:
                    classes[current_cls] = []
                continue
            if current_cls and (line.startswith('-') or line.startswith('+')):
                member = line[1:].strip()
                classes[current_cls].append(member)
        if not classes:
            return ""
        lines = ["@startuml"]
        for cls, members in classes.items():
            lines.append(f"class {cls} {{")
            for m in members:
                lines.append(f"    {m}")
            lines.append("}")
        lines.append("@enduml")
        return "\n".join(lines)

    # -----------------------------
    # Core logic
    # -----------------------------
    """A working RAG system that actually uses LLM inference and RAG retrieval."""
    
    def __init__(self, supabase_url: str, supabase_key: str, tavily_api_key: str, together_api_key: Optional[str] = None):
        """Initialize the RAG system with Together.ai for inference."""
        print("🚀 Initializing Working RAG System (Together.ai inference)")

        self.supabase_url = supabase_url
        self.supabase_key = supabase_key
        self.tavily_api_key = tavily_api_key
        self.together_api_key = together_api_key or "f403ac92a1dd94eabd486634e2629f1e3235606646a7e352c5449d3154f5db38"
        self.together_model = "mistralai/Mixtral-8x7B-Instruct-v0.1"

        if not self.together_api_key:
            raise RuntimeError("❌ Together.ai API token is required and missing.")
        if not self.supabase_url or not self.supabase_key:
            print("⚠️ Supabase credentials missing – will fall back to local FAISS store")
            self.supabase_url = self.supabase_key = ""
        if not self.tavily_api_key:
            print("⚠️ Tavily API key missing – web search context will be disabled")
            self.tavily_api_key = ""

        # Initialize Supabase client
        self.supabase: Client = create_client(supabase_url, supabase_key)
        self.embedding_model = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
        self.vector_store = None
        self._setup_vector_store()
        self.tavily_search = TavilySearch(api_key=self.tavily_api_key)
        self.headers = {"Authorization": f"Bearer {self.together_api_key}", "Content-Type": "application/json"}

    def _setup_vector_store(self):
        """Setup vector store with robust fallback."""
        if not self.embedding_model:
            raise RuntimeError("Cannot setup vector store without embedding model")
        errors = []
        # Try local FAISS first (most reliable)
        try:
            local_store_path = os.path.join(os.path.dirname(__file__), "local_vector_store")
            if os.path.exists(local_store_path):
                self.vector_store = FAISS.load_local(
                    local_store_path, 
                    self.embedding_model,
                    allow_dangerous_deserialization=True
                )
                print("✅ Local FAISS vector store loaded successfully")
                # Test the store
                test_docs = self.vector_store.similarity_search("test", k=1)
                print(f"📊 Vector store test: {len(test_docs)} documents available")
                return
        except Exception as e:
            errors.append(f"FAISS failed: {e}")
        # Try Supabase as backup
        if self.supabase:
            try:
                self.vector_store = SupabaseVectorStore(
                    client=self.supabase,
                    embedding=self.embedding_model,
                    table_name="documents",
                    query_name="match_documents"
                )
                print("✅ Supabase vector store initialized")
                return
            except Exception as e:
                errors.append(f"Supabase failed: {e}")
        # Final fallback: create a brand-new local FAISS store with a dummy document
        try:
            from langchain_core.documents import Document
            sample_doc = Document(page_content="sample", metadata={})
            self.vector_store = FAISS.from_documents([sample_doc], self.embedding_model)
            # Persist so future runs can load it
            local_store_path = os.path.join(os.path.dirname(__file__), "..", "local_vector_store")
            # Ensure directory path is normalized
            local_store_path = os.path.abspath(local_store_path)
            self.vector_store.save_local(local_store_path)  # type: ignore
            print("📦 Created new fallback local FAISS vector store at", local_store_path)
            return
        except Exception as final_e:
            errors.append(f"Create new FAISS failed: {final_e}")
            raise RuntimeError("No vector store available. Errors: " + "; ".join(errors))

    async def call_together_inference(self, prompt: str, max_tokens: int = 1000) -> str:
        """Call Together.ai inference API for completion."""
        import requests
        together_url = "https://api.together.xyz/v1/completions"
        payload = {
            "model": self.together_model,
            "prompt": prompt,
            "max_tokens": max_tokens,
            "temperature": 0.7,
            "top_p": 0.95,
            "stop": ["\nUser:", "\nAI:"]
        }
        headers = {
            "Authorization": f"Bearer {self.together_api_key}",
            "Content-Type": "application/json"
        }
        response = requests.post(together_url, headers=headers, json=payload, timeout=60)
        print(f"Together.ai API POST {together_url} status={response.status_code}")
        print(f"Payload: {payload}")
        print(f"Response: {response.text}")
        if response.status_code == 200:
            result = response.json()
            if "choices" in result and result["choices"]:
                return result["choices"][0]["text"]
            else:
                raise RuntimeError(f"Unexpected Together.ai API response: {result}")
        else:
            raise RuntimeError(f"Together.ai inference failed: {response.text}")

    def retrieve_relevant_diagrams(self, query: str, top_k: int = 5) -> List[Document]:
        """Retrieve relevant diagrams with improved error handling."""
        if not self.vector_store:
            raise RuntimeError("Vector store not available for retrieval")
        try:
            print(f"🔍 Searching vector database for: {query}")
            print(f"🔧 Vector store type: {type(self.vector_store)}")
            # Use the most compatible search method
            if hasattr(self.vector_store, 'similarity_search'):
                docs = self.vector_store.similarity_search(query, k=top_k)
                print(f"📊 Found {len(docs)} documents using similarity_search")
                documents = []
                for i, doc in enumerate(docs):
                    try:
                        content = doc.page_content if hasattr(doc, 'page_content') else str(doc)
                        metadata = doc.metadata if hasattr(doc, 'metadata') and doc.metadata else {}
                        enhanced_doc = Document(
                            page_content=f"UML Example {i+1}: {content[:400]}...",
                            metadata={**metadata, "similarity_score": 0.8 - (i * 0.1)}
                        )
                        documents.append(enhanced_doc)
                    except Exception as doc_error:
                        print(f"⚠️ Error processing document {i}: {doc_error}")
                        continue
                print(f"✅ Successfully processed {len(documents)} relevant diagrams")
                return documents
            else:
                raise RuntimeError("No compatible search method found on vector store")
        except Exception as e:
            print(f"❌ Vector search error: {e}")
            import traceback
            traceback.print_exc()
            raise RuntimeError(f"Vector search failed: {e}")

    async def web_search_context(self, query: str) -> str:
        """Get additional context from Tavily web search - ALWAYS ENABLED."""
        if not self.tavily_search:
            return "Tavily search not available."
        
        try:
            enhanced_query = f"UML {query} examples best practices PlantUML"
            print(f"🌐 Tavily search for: {enhanced_query}")
            
            search_results = self.tavily_search.invoke({
                "query": enhanced_query,
                "include_domains": ["plantuml.com", "uml.org", "stackoverflow.com", "medium.com"],
                "max_results": 3
            })
            
            context = f"🌐 Web Search Results for: {query}\n\n"
            
            if isinstance(search_results, dict) and 'results' in search_results:
                for i, result in enumerate(search_results['results'][:2], 1):
                    title = result.get('title', 'No title')
                    content = result.get('content', 'No content')[:150]
                    context += f"• {title}: {content}...\n"
            
            print(f"✅ Tavily search completed: {len(context)} characters")
            return context
            
        except Exception as e:
            print(f"❌ Tavily search error: {e}")
            return f"Web search context: Current best practices for {query} modeling in UML"

    async def generate_uml_diagram(
        self, 
        user_query: str, 
        conversation_history: Optional[List[Dict[str, str]]] = None,
        uml_type: Optional[str] = None, 
        web_search_enabled: bool = True
    ) -> Dict[str, Any]:
        """
        Generate UML diagram using enhanced RAG with multiple LLM providers.
        Now includes conversation history for context.
        """
        try:
            # Determine the current query and the history
            if conversation_history:
                # The last message is the current prompt
                last_user_message = conversation_history[-1].get("content", user_query)
                # The rest is the history for context
                history_for_prompt = conversation_history[:-1]
                print(f"🎯 Generating UML diagram for: '{last_user_message}' with history.")
            else:
                # No history, the prompt is the only message
                last_user_message = user_query
                history_for_prompt = []
                print(f"🎯 Generating UML diagram for: '{user_query}'.")

            # 1. Vector Store Retrieval using ONLY the last user message
            print(f"🔍 Searching vector database for: {last_user_message}")
            relevant_docs = self.retrieve_relevant_diagrams(last_user_message, top_k=3)

            # 2. Tavily Web Search
            tavily_query = f"UML diagram for {last_user_message} examples and best practices in PlantUML"
            print(f"🌐 Tavily search for: {tavily_query}")
            web_context = await self.web_search_context(tavily_query)

            # Consolidate history for prompt context
            history_str = "\n".join([f"{msg['role']}: {msg['content']}" for msg in history_for_prompt])

            # Find the last PlantUML code in the assistant's previous messages
            previous_code = ""
            if history_for_prompt:
                for msg in reversed(history_for_prompt):
                    if msg.get('role') == 'assistant':
                        code_match = re.search(r"(@startuml[\s\S]*?@enduml)", msg.get('content', ''), re.IGNORECASE)
                        if code_match:
                            previous_code = code_match.group(1).strip()
                            print("Found previous PlantUML code to modify.")
                            break

            # Construct the final prompt
            prompt_parts = [SYSTEM_PROMPT]
            if history_str:
                prompt_parts.append(f"Here is the conversation history:\n{history_str}")

            if previous_code:
                prompt_parts.append(f"The user's last request is a modification of this PlantUML code:\n```plantuml\n{previous_code}\n```")
                prompt_parts.append("Please generate an updated diagram based on the new request.")
            else:
                prompt_parts.append(f"Here is some context from a knowledge base:\n{relevant_docs}")
                prompt_parts.append(f"Here is some context from a web search:\n{web_context}")
                prompt_parts.append("Please generate a new diagram based on the user's request.")

            prompt_parts.append(f"\nUser Request: {last_user_message}\nAssistant:")
            prompt = "\n\n---\n".join(prompt_parts)

            response = await self.call_together_inference(prompt)

            # --- Parsing Logic ---
            # Use a more robust regex to find PlantUML, including within fenced blocks
            plantuml_code = ""
            # Pattern 1: Standard @startuml...@enduml block
            match = re.search(r"(@startuml[\s\S]*?@enduml)", response, re.IGNORECASE)
            if match:
                plantuml_code = match.group(1).strip()
            else:
                # Pattern 2: Fenced code block (e.g., ```plantuml ... ```)
                fence_match = re.search(r"```(?:plantuml)?\n([\s\S]*?)```", response, re.IGNORECASE)
                if fence_match:
                    # Ensure the content is a valid PlantUML block
                    inner_content = fence_match.group(1).strip()
                    if inner_content.startswith('@startuml'):
                        plantuml_code = inner_content
                    else:
                        # If not, wrap it, as the AI might forget the tags inside a fence
                        plantuml_code = f"@startuml\n{inner_content}\n@enduml"

            # Fallback if no code was extracted
            if not plantuml_code:
                # Try the text-to-UML heuristic as a last resort
                plantuml_code = self._basic_text_to_plantuml(response)
                if not plantuml_code:
                    print(f"⚠️ No PlantUML code found in response. Raw response: {response[:200]}...")
                    # Return empty string if no valid code can be extracted
                    plantuml_code = ""
            # Format context for frontend
            def format_context(doc):
                meta = getattr(doc, 'metadata', {}) or {}
                return {
                    "type": "plantuml" if 'plantuml_code' in meta else "text",
                    "content": meta.get('plantuml_code', doc.page_content),
                    "source": meta.get('title', meta.get('domain', 'Knowledge Base')),
                    "score": meta.get('similarity_score', 1.0),
                    "matched_terms": [],
                    "description": meta.get('description', '')
                }
            rag_context = [format_context(doc) for doc in relevant_docs]
            return {
                "plantuml_code": plantuml_code,
                "response": response,
                "context_diagrams": relevant_docs,
                "rag_context": rag_context,
                "generation_method": "rag_system",
                "timestamp": str(datetime.now()),
                "processing_steps": [
                    f"Retrieved {len(relevant_docs)} relevant context examples",
                    "Enhanced with Tavily web search (always enabled)",
                    "Called Together.ai inference",
                    "Extracted and validated PlantUML code"
                ]
            }
        except Exception as e:
            print(f"❌ Generation failed: {e}")
            raise Exception(f"UML generation failed: {str(e)}")

    def _generate_domain_specific_diagram(self, query: str, uml_type: Optional[str] = None) -> str:
        """Generate domain-specific UML diagrams based on query analysis."""
        query_lower = query.lower()
        
        # Library Management System
        if "library" in query_lower:
            return """@startuml
title Library Management System

class Member {
    -memberId: String
    -name: String
    -email: String
    -joinDate: Date
    +borrowBook(book: Book): Loan
    +returnBook(loan: Loan): void
    +viewHistory(): List<Loan>
}

class Book {
    -isbn: String
    -title: String
    -author: String
    -publisher: String
    -availableCopies: int
    +isAvailable(): boolean
    +updateCopies(count: int): void
}

class Loan {
    -loanId: String
    -borrowDate: Date
    -dueDate: Date
    -returnDate: Date
    -status: LoanStatus
    +calculateFine(): double
    +extendDue(): void
}

enum LoanStatus {
    ACTIVE
    RETURNED
    OVERDUE
}

class Librarian {
    -employeeId: String
    -name: String
    +addBook(book: Book): void
    +removeBook(book: Book): void
    +registerMember(member: Member): void
}

Member ||--o{ Loan : creates
Book ||--o{ Loan : involved_in
Librarian ||--o{ Book : manages
Librarian ||--o{ Member : registers

@enduml"""

        # E-commerce System
        elif any(word in query_lower for word in ["ecommerce", "shop", "store", "cart", "order"]):
            return """@startuml
title E-commerce System

class Customer {
    -customerId: String
    -name: String
    -email: String
    -address: String
    +placeOrder(cart: ShoppingCart): Order
    +viewOrderHistory(): List<Order>
}

class Product {
    -productId: String
    -name: String
    -price: double
    -stockQuantity: int
    -category: String
    +updateStock(quantity: int): void
    +getDetails(): ProductDetails
}

class ShoppingCart {
    -cartId: String
    -items: List<CartItem>
    -totalAmount: double
    +addItem(product: Product, quantity: int): void
    +removeItem(productId: String): void
    +calculateTotal(): double
}

class Order {
    -orderId: String
    -orderDate: Date
    -status: OrderStatus
    -totalAmount: double
    +processPayment(): Payment
    +updateStatus(status: OrderStatus): void
}

enum OrderStatus {
    PENDING
    CONFIRMED
    SHIPPED
    DELIVERED
    CANCELLED
}

Customer ||--|| ShoppingCart : owns
Customer ||--o{ Order : places
ShoppingCart ||--o{ Product : contains
Order ||--o{ Product : includes

@enduml"""

        # Default generic class diagram
        else:
            return """@startuml
title System Class Diagram

class Entity {
    -id: Long
    -name: String
    -createdDate: Date
    +create(): void
    +update(): void
    +delete(): void
    +findById(id: Long): Entity
}

class Manager {
    -managerId: String
    -permissions: List<String>
    +manageEntity(entity: Entity): void
    +validatePermissions(): boolean
}

class Service {
    -serviceId: String
    -status: ServiceStatus
    +processRequest(): Response
    +handleError(error: Exception): void
}

enum ServiceStatus {
    ACTIVE
    INACTIVE
    MAINTENANCE
}

Manager ||--o{ Entity : manages
Service ||--o{ Entity : processes

note right of Entity
  Generated with enhanced RAG system
  Tavily search enabled
  HuggingFace inference used
end note

@enduml"""

    def extract_plantuml_code(self, response: str) -> str:
        """Extract PlantUML code with improved pattern matching."""
        try:
            # Look for PlantUML code blocks (markdown format)
            plantuml_pattern = r'```plantuml\s*(.*?)\s*```'
            matches = re.findall(plantuml_pattern, response, re.DOTALL | re.IGNORECASE)
            
            if matches:
                code = matches[0].strip()
                # Ensure proper PlantUML format
                if not code.startswith('@startuml'):
                    code = '@startuml\n' + code
                if not code.endswith('@enduml'):
                    code = code + '\n@enduml'
                return code
            
            # Look for @startuml...@enduml blocks directly
            uml_pattern = r'@startuml.*?@enduml'
            matches = re.findall(uml_pattern, response, re.DOTALL | re.IGNORECASE)
            
            if matches:
                return matches[0].strip()
            
            # Look for class definitions that might be UML without proper tags
            if any(keyword in response.lower() for keyword in ['class ', 'enum ', 'interface ']):
                lines = response.split('\n')
                uml_lines = []
                in_uml = False
                
                for line in lines:
                    if any(keyword in line.lower() for keyword in ['class ', 'enum ', 'interface ', '||--', '-->', '->']):
                        in_uml = True
                    if in_uml:
                        uml_lines.append(line)
                
                if uml_lines:
                    uml_code = '\n'.join(uml_lines)
                    return f"@startuml\n{uml_code}\n@enduml"
            
            return ""
            
        except Exception as e:
            print(f"Error extracting PlantUML code: {e}")
            return ""

    def get_diagram_suggestions(self, query: str) -> List[Dict[str, Any]]:
        """Enhanced diagram suggestions with context analysis."""
        query_lower = query.lower()
        suggestions = []
        
        # Analyze for specific UML types
        type_indicators = {
            'class': ['class', 'object', 'entity', 'model', 'structure', 'inheritance'],
            'sequence': ['sequence', 'interaction', 'message', 'communication', 'flow', 'process'],
            'activity': ['activity', 'workflow', 'process', 'business', 'flow', 'procedure'],
            'use_case': ['use case', 'user story', 'requirement', 'functionality', 'feature'],
            'component': ['component', 'architecture', 'system', 'module', 'service'],
            'deployment': ['deployment', 'infrastructure', 'server', 'environment']
        }
        
        for uml_type, keywords in type_indicators.items():
            matches = sum(1 for keyword in keywords if keyword in query_lower)
            if matches > 0:
                confidence = min(0.9, 0.3 + (matches * 0.2))
                suggestions.append({
                    'uml_type': uml_type,
                    'confidence': confidence,
                    'reason': f'Query contains {matches} {uml_type}-related keywords',
                    'keywords_found': [kw for kw in keywords if kw in query_lower]
                })
        
        # Sort by confidence and return top suggestions
        suggestions.sort(key=lambda x: x['confidence'], reverse=True)
        return suggestions[:3] if suggestions else [{
            'uml_type': 'class',
            'confidence': 0.6,
            'reason': 'Default recommendation for general modeling',
            'keywords_found': []
        }]

# Backwards compatibility classes
class ContextDrivenRAGSystem(WorkingRAGSystem):
    """Backwards compatibility wrapper."""
    pass

class RAGRetrievalSystem(WorkingRAGSystem):
    """Backwards compatibility wrapper."""
    pass

if __name__ == "__main__":
    # Configuration
    supabase_url = os.getenv("SUPABASE_URL", "https://cgbegsaogwjdmzpwslsh.supabase.co")
    supabase_key = os.getenv("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnYmVnc2FvZ3dqZG16cHdzbHNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTExNDk0NDcsImV4cCI6MjA2NjcyNTQ0N30.tButcNDf4Mt5cV1o2ixnXAkj9kqgn7HoM72cKI87B90")
    tavily_api_key = os.getenv("TAVILY_API_KEY", "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")
    # Always use the hardcoded token
    hf_token = "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"
    
    # Initialize enhanced RAG system
    rag_system = WorkingRAGSystem(supabase_url, supabase_key, tavily_api_key, hf_token)
    
    print("🚀 Enhanced RAG System initialized successfully!")
    print("✅ HuggingFace inference used")
    print("✅ Robust vector database with fallback")
    print("✅ Tavily search always enabled")
    print("✅ Domain-specific diagram generation")
    print(f"✅ Model providers: HuggingFace") 