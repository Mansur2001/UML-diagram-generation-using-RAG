import os
import json
import numpy as np
from typing import List, Dict, Any, Optional
from langchain_community.vectorstores.supabase import SupabaseVectorStore
from langchain_community.vectorstores.faiss import FAISS
from langchain_community.embeddings.huggingface import HuggingFaceEmbeddings
from langchain_core.documents import Document
from supabase import create_client, Client
import asyncio
from tqdm import tqdm

class VectorDatabaseManager:
    def __init__(self, supabase_url: str, supabase_key: str):
        """Initialize the vector database manager."""
        self.supabase_url = supabase_url
        self.supabase_key = supabase_key
        self.use_local_fallback = False
        
        try:
            self.supabase: Client = create_client(supabase_url, supabase_key)
        except Exception as e:
            print(f"⚠️ Supabase connection failed: {e}")
            self.use_local_fallback = True
        
        # Initialize embedding model (fixed deprecation)
        self.embedding_model = HuggingFaceEmbeddings(
            model_name="sentence-transformers/all-MiniLM-L6-v2",
            model_kwargs={'device': 'cpu'},
            encode_kwargs={'normalize_embeddings': True}
        )
        
        # Initialize vector store with fallback
        if not self.use_local_fallback:
            try:
                self.vector_store = SupabaseVectorStore(
                    client=self.supabase,
                    embedding=self.embedding_model,
                    table_name="documents",
                    query_name="match_documents"
                )
            except Exception as e:
                print(f"⚠️ Supabase vector store failed, using local fallback: {e}")
                self.use_local_fallback = True
                self._setup_local_store()
        else:
            self._setup_local_store()
    
    def _setup_local_store(self):
        """Setup local FAISS vector store as fallback."""
        try:
            # Try to load existing local store
            if os.path.exists("local_vector_store"):
                self.vector_store = FAISS.load_local(
                    "local_vector_store", 
                    self.embedding_model,
                    allow_dangerous_deserialization=True
                )
                print("✅ Loaded existing local vector store")
            else:
                # Create empty local store
                sample_doc = Document(page_content="sample", metadata={})
                self.vector_store = FAISS.from_documents([sample_doc], self.embedding_model)
                print("📦 Created new local vector store")
        except Exception as e:
            print(f"❌ Local vector store setup failed: {e}")
            self.vector_store = None

    def create_supabase_table(self):
        """Create or verify Supabase table."""
        if self.use_local_fallback:
            print("✅ Using local vector store, no table creation needed")
            return True
            
        try:
            # Check if documents table exists
            existing_tables = self.supabase.table('documents').select('id').limit(1).execute()
            print("✅ Documents table already exists or is accessible")
            return True
        except Exception as e:
            print(f"⚠️ Documents table check failed: {e}")
            print("📝 Note: Using local fallback mode")
            self.use_local_fallback = True
            self._setup_local_store()
            return True

    def load_knowledge_base(self, file_path: str) -> List[Dict[str, Any]]:
        """Load the knowledge base from JSON file."""
        try:
            with open(file_path, 'r') as f:
                knowledge_base = json.load(f)
            print(f"Loaded {len(knowledge_base)} samples from {file_path}")
            return knowledge_base
        except Exception as e:
            print(f"Error loading knowledge base: {e}")
            return []

    def prepare_documents(self, knowledge_base: List[Dict[str, Any]]) -> List[Document]:
        """
        Convert knowledge base to LangChain documents using PlantUML code.
        """
        documents = []
        for item in knowledge_base:
            content = f"""UML Type: {item['uml_type']}
Title: {item['title']}
Domain: {item['domain']}
Complexity: {item['complexity']}
Pattern: {item['pattern']}
Description: {item['description']}
PlantUML Code: {item['plantuml_code']}"""

            metadata = {
                'id': item['id'],
                'uml_type': item['uml_type'],
                'title': item['title'],
                'domain': item['domain'],
                'complexity': item['complexity'],
                'pattern': item['pattern'],
                'plantuml_code': item['plantuml_code'],
                'description': item['description']
            }
            documents.append(Document(page_content=content, metadata=metadata))
        return documents

    def insert_documents_batch(self, documents: List[Document], batch_size: int = 10):
        """Insert documents into vector store (local or Supabase)."""
        if not self.vector_store:
            print("❌ No vector store available")
            return False
            
        total_documents = len(documents)
        success_count = 0
        
        if self.use_local_fallback:
            try:
                # For local FAISS store, add all documents at once
                print("📦 Adding documents to local vector store...")
                self.vector_store.add_documents(documents)
                success_count = total_documents
                
                # Save the local store
                if self.use_local_fallback and hasattr(self.vector_store, 'save_local'):
                    self.vector_store.save_local("local_vector_store")  # type: ignore
                print(f"✅ Successfully added {success_count} documents to local store")
                
            except Exception as e:
                print(f"❌ Error adding documents to local store: {e}")
                return False
        else:
            # Original Supabase batch processing
            for i in tqdm(range(0, total_documents, batch_size), desc="Inserting documents"):
                batch = documents[i:i + batch_size]
                
                try:
                    self.vector_store.add_documents(batch)
                    success_count += len(batch)
                    
                    if i > 0 and i % 100 == 0:
                        print(f"✅ Inserted {success_count} documents successfully")
                        
                except Exception as e:
                    print(f"❌ Error inserting batch {i//batch_size + 1}: {e}")
                    continue
        
        print(f"📊 Successfully inserted {success_count}/{total_documents} documents")
        return success_count > 0

    def insert_knowledge_base(self, knowledge_base: List[Dict[str, Any]], batch_size: int = 10):
        """Insert the entire knowledge base into Supabase."""
        print("📝 Preparing documents...")
        documents = self.prepare_documents(knowledge_base)
        
        print("📤 Inserting documents into Supabase...")
        success = self.insert_documents_batch(documents, batch_size)
        
        if success:
            print("✅ Knowledge base insertion completed!")
        else:
            print("⚠️ Knowledge base insertion completed with some failures")
        
        return success

    def search_similar_diagrams(self, query: str, top_k: int = 5, 
                               uml_type: Optional[str] = None,
                               domain: Optional[str] = None,
                               complexity: Optional[str] = None) -> List[Dict[str, Any]]:
        """Search for similar UML diagrams."""
        if not self.vector_store:
            print("❌ No vector store available for search")
            return []
            
        try:
            # Perform similarity search
            results = self.vector_store.similarity_search_with_score(
                query, 
                k=top_k
            )
            
            # Format results
            formatted_results = []
            for doc, score in results:
                # Apply filters if specified
                metadata = doc.metadata
                if uml_type and metadata.get('uml_type') != uml_type:
                    continue
                if domain and metadata.get('domain') != domain:
                    continue
                if complexity and metadata.get('complexity') != complexity:
                    continue
                
                result = {
                    'id': metadata.get('id', 'unknown'),
                    'uml_type': metadata.get('uml_type', 'unknown'),
                    'title': metadata.get('title', 'Untitled'),
                    'domain': metadata.get('domain', 'general'),
                    'complexity': metadata.get('complexity', 'medium'),
                    'pattern': metadata.get('pattern', 'basic'),
                    'plantuml_code': metadata.get('plantuml_code', ''),
                    'description': metadata.get('description', ''),
                    'similarity_score': 1 - score,  # Convert distance to similarity
                    'content': doc.page_content
                }
                formatted_results.append(result)
            
            # Sort by similarity score and limit results
            formatted_results.sort(key=lambda x: x['similarity_score'], reverse=True)
            return formatted_results[:top_k]
            
        except Exception as e:
            print(f"❌ Error searching for similar diagrams: {e}")
            return []

    def get_diagram_by_id(self, diagram_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific diagram by ID using search."""
        if not self.vector_store:
            print("❌ No vector store available")
            return None
            
        try:
            # Use similarity search to find by ID
            results = self.vector_store.similarity_search(f"id:{diagram_id}", k=10)
            
            for doc in results:
                if doc.metadata.get('id') == diagram_id:
                    return {
                        'id': doc.metadata.get('id'),
                        'uml_type': doc.metadata.get('uml_type'),
                        'title': doc.metadata.get('title'),
                        'domain': doc.metadata.get('domain'),
                        'complexity': doc.metadata.get('complexity'),
                        'pattern': doc.metadata.get('pattern'),
                        'plantuml_code': doc.metadata.get('plantuml_code'),
                        'description': doc.metadata.get('description'),
                        'content': doc.page_content
                    }
            return None
                
        except Exception as e:
            print(f"Error retrieving diagram {diagram_id}: {e}")
            return None

    def get_diagrams_by_type(self, uml_type: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Get diagrams by UML type using search."""
        return self.search_similar_diagrams(f"UML Type: {uml_type}", top_k=limit, uml_type=uml_type)

    def get_diagrams_by_domain(self, domain: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Get diagrams by domain using search."""
        return self.search_similar_diagrams(f"Domain: {domain}", top_k=limit, domain=domain)

    def get_statistics(self) -> Dict[str, Any]:
        """Get statistics about the knowledge base."""
        if not self.vector_store:
            return {
                'total_diagrams': 0,
                'uml_type_distribution': {},
                'domain_distribution': {},
                'complexity_distribution': {},
                'error': 'No vector store available'
            }
            
        try:
            # Perform a broad search to sample the database
            sample_results = self.vector_store.similarity_search("UML diagram", k=100)
            
            if not sample_results:
                return {
                    'total_diagrams': 0,
                    'uml_type_distribution': {},
                    'domain_distribution': {},
                    'complexity_distribution': {},
                    'note': 'Database appears to be empty or inaccessible'
                }
            
            # Count distributions from sample
            uml_type_counts = {}
            domain_counts = {}
            complexity_counts = {}
            
            for doc in sample_results:
                metadata = doc.metadata
                
                uml_type = metadata.get('uml_type', 'unknown')
                uml_type_counts[uml_type] = uml_type_counts.get(uml_type, 0) + 1
                
                domain = metadata.get('domain', 'unknown')
                domain_counts[domain] = domain_counts.get(domain, 0) + 1
                
                complexity = metadata.get('complexity', 'unknown')
                complexity_counts[complexity] = complexity_counts.get(complexity, 0) + 1
            
            return {
                'total_diagrams': len(sample_results),
                'uml_type_distribution': uml_type_counts,
                'domain_distribution': domain_counts,
                'complexity_distribution': complexity_counts,
                'note': f'Statistics based on sample of {len(sample_results)} documents'
            }
            
        except Exception as e:
            print(f"Error getting statistics: {e}")
            return {
                'total_diagrams': 0,
                'uml_type_distribution': {},
                'domain_distribution': {},
                'complexity_distribution': {},
                'error': str(e)
            }

if __name__ == "__main__":
    # Example usage
    supabase_url = os.getenv("SUPABASE_URL", "https://cgbegsaogwjdmzpwslsh.supabase.co")
    supabase_key = os.getenv("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnYmVnc2FvZ3dqZG16cHdzbHNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTExNDk0NDcsImV4cCI6MjA2NjcyNTQ0N30.tButcNDf4Mt5cV1o2ixnXAkj9kqgn7HoM72cKI87B90")
    
    # Initialize manager
    manager = VectorDatabaseManager(supabase_url, supabase_key)
    
    # Test database connection
    success = manager.create_supabase_table()
    print(f"Database setup: {'✅ Success' if success else '❌ Failed'}")
    
    # Example search
    results = manager.search_similar_diagrams("class diagram for e-commerce system", top_k=3)
    print(f"Search results: {len(results)} found")
    for result in results:
        print(f"- {result['title']} (Score: {result['similarity_score']:.3f})") 