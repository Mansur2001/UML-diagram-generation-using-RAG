import os
import sys
import asyncio
from pathlib import Path

# Ensure project root (parent of backend) is on PYTHONPATH for `rag` package imports
project_root = Path(__file__).resolve().parents[1]
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))
import logging
import json
import base64
import traceback
import sys
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from dotenv import load_dotenv

class ConversationBufferMemory:
    """A simple in-memory buffer for storing conversation history."""
    def __init__(self, session_id: str):
        self.session_id = session_id
        self.messages: List[Dict[str, str]] = []

    def add_message(self, role: str, content: str):
        """Add a message to the buffer."""
        self.messages.append({"role": role, "content": content})

    def get_history(self) -> List[Dict[str, str]]:
        """Get the full conversation history."""
        return self.messages

    def clear(self):
        """Clear the conversation history."""
        self.messages = []



# Import our RAG system components
try:
    from rag.rag_retrieval_system import ContextDrivenRAGSystem  # type: ignore
    RAG_AVAILABLE = True
    print("✅ RAG system modules imported successfully")
except ImportError as e:
    debug_paths = "\n - " + "\n - ".join(sys.path)
    print(f"⚠️ Failed to import RAG modules: {e}\n🔍 sys.path after insertion:{debug_paths}")
    RAG_AVAILABLE = False

# Load environment variables
load_dotenv()
import os
# Load sensitive keys strictly from environment / .env file – no hard-coded fallbacks
required_vars = [
    "SUPABASE_URL",
    "SUPABASE_KEY",
    "TOGETHER_API_KEY",
    "TAVILY_API_KEY",


]
missing = [var for var in required_vars if not os.getenv(var)]
if missing:
    missing_list = ", ".join(missing)
    raise RuntimeError(
        f"Missing required environment variables: {missing_list}. "
        "Create a .env file in the project root or set them in your hosting provider."
    )



# In-memory store for conversation sessions. A real app would use Redis or a DB.
conversation_sessions: Dict[str, ConversationBufferMemory] = {}

class GenerateRequest(BaseModel):
    prompt: str
    webSearchEnabled: Optional[bool] = False
    diagram_type: Optional[str] = None

class ChatMessage(BaseModel):
    role: str
    content: str

class RenderRequest(BaseModel):
    uml_code: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]

def render_plantuml_to_images(uml_code: str) -> Dict[str, Optional[str]]:
    """Render PlantUML code to PNG and SVG images with robust error handling."""
    import os
    import tempfile
    import subprocess
    from pathlib import Path
    
    # Create a temporary directory for PlantUML output
    with tempfile.TemporaryDirectory() as temp_dir:
        # Write the PlantUML code to a temporary file
        uml_file = Path(temp_dir) / "diagram.puml"
        with open(uml_file, 'w') as f:
            f.write(uml_code)
        
        # Set up output file paths
        png_file = uml_file.with_suffix('.png')
        svg_file = uml_file.with_suffix('.svg')
        
        png_b64, svg_content = None, None
        
        # Function to run PlantUML command
        def run_plantuml(output_format: str) -> bool:
            try:
                cmd = [
                    'java', '-Djava.awt.headless=true',
                    '-jar', 'plantuml.jar',
                    f'-t{output_format}',
                    '-charset', 'UTF-8',
                    '-pipe'
                ]
                
                result = subprocess.run(
                    cmd,
                    input=uml_code.encode('utf-8'),
                    capture_output=True,
                    cwd=temp_dir,
                    timeout=10
                )
                
                if result.returncode != 0:
                    print(f"PlantUML error: {result.stderr.decode('utf-8', errors='replace')}")
                    return False
                    
                output_file = uml_file.with_suffix(f'.{output_format}')
                if output_file.exists():
                    return True
                    
                # If no file was created, try to use stdout
                if result.stdout and len(result.stdout) > 0:
                    with open(output_file, 'wb') as f:
                        f.write(result.stdout)
                    return True
                    
                return False
                
            except Exception as e:
                print(f"Error running PlantUML: {e}")
                return False
        
        # Try to render PNG
        if run_plantuml('png') and png_file.exists():
            with open(png_file, 'rb') as f:
                png_b64 = base64.b64encode(f.read()).decode('utf-8')
        
        # Try to render SVG
        if run_plantuml('svg') and svg_file.exists():
            with open(svg_file, 'r', encoding='utf-8') as f:
                svg_content = f.read()
        
        if not png_b64 and not svg_content:
            raise HTTPException(
                status_code=500,
                detail="Failed to render PlantUML. Please check if Java is installed and the PlantUML syntax is correct."
            )
            
        return {"png": png_b64, "svg": svg_content}

    return {"png": png_b64, "svg": svg_content}

# Initialize FastAPI app
app = FastAPI(title="UML RAG Backend", version="1.0.0")

# -------------------
# Helper functions
# -------------------
import re
_uml_block_re = re.compile(r"@startuml[\s\S]*?@enduml", re.IGNORECASE)

def extract_plantuml(text: str) -> str | None:
    """Extract first PlantUML diagram from text."""
    # fenced block first
    fence = re.search(r"```(?:plantuml)?\s*([\s\S]*?)```", text, re.IGNORECASE)
    if fence:
        return fence.group(1).strip()
    match = _uml_block_re.search(text or "")
    if match:
        return match.group(0).strip()
    return None

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "http://frontend:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize RAG system
rag_system = None
if RAG_AVAILABLE:
    try:
        supabase_url = os.getenv("SUPABASE_URL", "https://cgbegsaogwjdmzpwslsh.supabase.co")
        supabase_key = os.getenv("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNnYmVnc2FvZ3dqZG16cHdzbHNoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTExNDk0NDcsImV4cCI6MjA2NjcyNTQ0N30.tButcNDf4Mt5cV1o2ixnXAkj9kqgn7HoM72cKI87B90")
        tavily_api_key = os.getenv("TAVILY_API_KEY", "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")
        together_api_key = os.getenv("TOGETHER_API_KEY", "f403ac92a1dd94eabd486634e2629f1e3235606646a7e352c5449d3154f5db38")
        
        rag_system = ContextDrivenRAGSystem(supabase_url, supabase_key, tavily_api_key, together_api_key)
        print("✅ RAG system initialized successfully")
    except Exception as e:
        print(f"❌ Failed to initialize RAG system: {e}")
        rag_system = None
else:
    print("❌ RAG system not available")

@app.get("/")
async def root():
    """Root endpoint with system status."""
    return {
        "message": "UML RAG Backend API",
        "version": "1.0.0",
        "status": "operational",
        "rag_system_available": rag_system is not None,
        "features": [
            "UML diagram generation using RAG system",
            "PlantUML rendering to PNG/SVG",
            "Chat interface with UML expertise",
            "Context-driven diagram suggestions"
        ]
    }

@app.get("/health")
async def health():
    """Health check endpoint."""
    health_status = {
        "status": "healthy",
        "rag_system": rag_system is not None,
        "database_connection": False
    }
    
    # Test database connection if RAG system is available
    if rag_system:
        try:
            # Try a simple search to test the connection
            test_results = rag_system.retrieve_relevant_diagrams("test query", top_k=1)
            health_status["database_connection"] = True
        except Exception as e:
            print(f"Database health check failed: {e}")
            health_status["database_connection"] = False
    
    return health_status

# In-memory store for conversation sessions. A real app would use Redis or a DB.
conversation_sessions: Dict[str, ConversationBufferMemory] = {}

@app.post("/api/chat")
async def chat_with_rag(request: ChatRequest):
    """Handle conversational chat with the RAG system."""
    if not rag_system:
        raise HTTPException(status_code=503, detail="RAG system not available")

    # For simplicity, we'll use a fixed session ID. In a real app, this would be dynamic.
    session_id = "default_session"
    if session_id not in conversation_sessions:
        conversation_sessions[session_id] = ConversationBufferMemory(session_id=session_id)

    memory = conversation_sessions[session_id]
    
    # The full conversation history is in the request
    conversation_history = [msg.dict() for msg in request.messages]
    user_prompt = conversation_history[-1]["content"]

    # Update the session memory with the new messages from the client
    # This assumes the client sends the full history each time.
    memory.messages = conversation_history

    try:
        result = await rag_system.generate_uml_diagram(
            user_query=user_prompt,
            conversation_history=conversation_history # Pass the list of dicts directly
        )
        
        # Add the AI's response to the memory. CRITICAL: Use the cleaned 'plantuml_code' for the history
        # to ensure consistency between what the user sees rendered and what the AI sees on the next turn.
        assistant_response_for_history = result.get('plantuml_code', '')
        if not assistant_response_for_history:
            # If cleaning failed, use the raw response as a fallback for the history.
            assistant_response_for_history = result.get('response', '')

        if assistant_response_for_history:
            memory.add_message("assistant", assistant_response_for_history)

        return {
            "success": True,
            "uml_code": result.get('plantuml_code', ''),
            "full_response": result.get('response', ''),
            "context": result.get('rag_context', []),
            "generation_method": result.get('generation_method', 'rag_system'),
            "timestamp": result.get('timestamp'),
            "processing_steps": result.get('processing_steps', [])
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate")
async def generate_diagram(request: GenerateRequest):
    """Generate UML diagram using RAG system."""
    try:
        if not rag_system:
            rag_status = "RAG system is None. "
            try:
                # Try to initialize RAG system with debug info
                supabase_url = os.getenv("SUPABASE_URL")
                supabase_key = os.getenv("SUPABASE_KEY")
                tavily_api_key = os.getenv("TAVILY_API_KEY")
                together_api_key = os.getenv("TOGETHER_API_KEY")
                
                rag_status += f"\nEnvironment check:\n"
                rag_status += f"- SUPABASE_URL: {'Set' if supabase_url else 'Missing'}\n"
                rag_status += f"- SUPABASE_KEY: {'Set' if supabase_key else 'Missing'}\n"
                rag_status += f"- TAVILY_API_KEY: {'Set' if tavily_api_key else 'Missing'}\n"
                rag_status += f"- TOGETHER_API_KEY: {'Set' if together_api_key else 'Missing'}"
                
                # Try to create a simple RAG system to test
                from rag.rag_retrieval_system import WorkingRAGSystem
                test_rag = WorkingRAGSystem(
                    supabase_url or "https://cgbegsaogwjdmzpwslsh.supabase.co",
                    supabase_key or "default_key",
                    tavily_api_key or "default_key",
                    together_api_key or "default_key"
                )
                rag_status += "\n✅ Test RAG initialization succeeded"
                
            except Exception as e:
                rag_status += f"\n❌ RAG initialization failed: {str(e)}\n"
                rag_status += f"\nCurrent working directory: {os.getcwd()}\n"
                rag_status += f"Python path: {sys.path}\n"
                rag_status += f"Environment variables: {os.environ.get('PYTHONPATH', 'Not set')}"
                
            raise HTTPException(
                status_code=503, 
                detail={
                    "error": "RAG system not available",
                    "debug_info": rag_status,
                    "suggestion": "Check backend logs and ensure all required environment variables are set"
                }
            )
        
        print(f"🎯 Generating diagram for: {request.prompt}")
        
        try:
            # Use the RAG system to generate the diagram with Tavily search always enabled
            result = await rag_system.generate_uml_diagram(
                user_query=request.prompt,
                uml_type=request.diagram_type,
                web_search_enabled=True  # Always enable Tavily search
            )
            
            if not result:
                raise HTTPException(
                    status_code=500, 
                    detail={
                        "error": "No result from RAG system",
                        "debug_info": "RAG system returned None"
                    }
                )
            
            # Extract PlantUML code
            plantuml_code = result.get('plantuml_code', '')
            
            if not plantuml_code:
                raise HTTPException(
                    status_code=500, 
                    detail={
                        "error": "No PlantUML code generated",
                        "debug_info": f"RAG result: {json.dumps(result, default=str)[:500]}..."
                    }
                )
            
            print("✅ Diagram generated successfully")
            
            return {
                "success": True,
                "uml_code": plantuml_code,
                "full_response": result.get('response', ''),
                "context": result.get('rag_context', []),
                "generation_method": result.get('generation_method', 'rag_system'),
                "timestamp": result.get('timestamp'),
                "processing_steps": result.get('processing_steps', [])
            }
            
        except Exception as gen_error:
            error_detail = {
                "error": str(gen_error),
                "type": type(gen_error).__name__,
                "traceback": str(traceback.format_exc())
            }
            print(f"❌ Generation error: {error_detail}")
            raise HTTPException(
                status_code=500,
                detail=error_detail
            )
        
    except HTTPException as http_err:
        print(f"❌ HTTP Error: {http_err}")
        raise
    except Exception as e:
        error_detail = {
            "error": str(e),
            "type": type(e).__name__,
            "traceback": str(traceback.format_exc()),
            "rag_system_available": rag_system is not None,
            "python_path": sys.path,
            "env_vars": {
                "SUPABASE_URL": "Set" if os.getenv("SUPABASE_URL") else "Missing",
                "SUPABASE_KEY": "Set" if os.getenv("SUPABASE_KEY") else "Missing",
                "TAVILY_API_KEY": "Set" if os.getenv("TAVILY_API_KEY") else "Missing",
                "TOGETHER_API_KEY": "Set" if os.getenv("TOGETHER_API_KEY") else "Missing"
            }
        }
        print(f"❌ Unexpected error: {json.dumps(error_detail, indent=2)}")
        raise HTTPException(
            status_code=500,
            detail=error_detail
        )

@app.post("/api/render")
async def render_plantuml(request: RenderRequest):
    """Render PlantUML code to images."""
    try:
        if not request.uml_code.strip():
            raise HTTPException(status_code=400, detail="UML code is required")
        
        print("🖼️ Rendering PlantUML to images...")
        
        # Render the PlantUML code
        images = render_plantuml_to_images(request.uml_code)
        
        if not images["png"] and not images["svg"]:
            raise HTTPException(
                status_code=500, 
                detail="Failed to render PlantUML code. Please check the syntax."
            )
        
        print("✅ PlantUML rendered successfully")
        
        return {
            "success": True,
            "png": images["png"],
            "svg": images["svg"],
            "uml_code": request.uml_code
        }
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback, textwrap
        tb = textwrap.indent(''.join(traceback.format_exc()), '    ')
        print(f"❌ Rendering error: {e}\n{tb}")
        raise HTTPException(status_code=500, detail=f"Rendering failed: {e}: {tb}")

@app.post("/api/chat")
async def chat_with_system(request: ChatRequest):
    """Conversational chat endpoint with persistent memory. FINAL VERSION."""
    session_id = "default_session"  # Fixed session ID for now

    try:
        if not request.messages:
            raise HTTPException(status_code=400, detail={"error": "Messages are required"})
        if not rag_system:
            raise HTTPException(status_code=503, detail={"error": "RAG system not available"})

        # 1. Get or create the conversation memory for this session
        if session_id not in conversation_sessions:
            print(f"✨ Creating new memory for session: {session_id}")
            conversation_sessions[session_id] = ConversationBufferMemory(session_id=session_id)
        memory = conversation_sessions[session_id]

        # 2. Sync memory with the history from the frontend
        memory.clear()
        for msg in request.messages:
            memory.add_message(role=msg.role, content=msg.content)

        # 3. Get the full history and the latest user query separately
        conversation_history = memory.get_formatted_history()
        latest_user_query = request.messages[-1].content if request.messages else ""

        print(f"🧠 Calling RAG system for query: '{latest_user_query}' with full context.")

        # 4. Call the RAG system's main entry point
        # This method is designed to handle both diagram generation and general chat
        # by using the powerful SYSTEM_PROMPT.
        rag_result = await rag_system.generate_uml_diagram(
            user_query=latest_user_query, # Pass only the last message as the direct query
            conversation_history=conversation_history, # Pass the full history for context
            web_search_enabled=True
        )

        final_response_text = rag_result.get('response', '')

        # Clean up duplicate PlantUML code in the response
        if final_response_text.count('@startuml') > 1:
            # Find the first complete PlantUML block
            start = final_response_text.find('@startuml')
            end = final_response_text.find('@enduml', start)
            if start != -1 and end != -1:
                # Extract the first complete block
                uml_block = final_response_text[start:end+7]  # +7 for '@enduml' length
                # Replace all occurrences with just one copy
                final_response_text = final_response_text.replace(uml_block, '').strip() + f'\n\n{uml_block}'

        # 5. Add the AI's response to memory for the next turn
        memory.add_message(role="assistant", content=final_response_text)

        # 6. Extract PlantUML and render images if a diagram was generated
        plantuml_code = extract_plantuml(final_response_text)
        images = render_plantuml_to_images(plantuml_code) if plantuml_code else None

        return {
            "success": True,
            "response": final_response_text.strip(),
            "uml_code": plantuml_code,
            "images": images,
            "rag_context": rag_result.get('rag_context', [])
        }

    except HTTPException as http_err:
        raise http_err # Re-raise HTTPExceptions to let FastAPI handle them
    except Exception as e:
        print(f"❌ Unexpected Chat Error: {e}\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=500,
            detail={"error": "An unexpected error occurred in the chat endpoint.", "details": str(e)}
        )

if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting UML RAG Backend Server...")
    print("📊 RAG System Available:", rag_system is not None)
    uvicorn.run("backend:app", host="0.0.0.0", port=8001, reload=True)