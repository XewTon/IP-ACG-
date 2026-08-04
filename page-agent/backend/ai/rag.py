"""
IP 知识库检索。
优先 LlamaIndex + Chroma；无依赖或失败时回退为本地 Markdown 关键词检索。
"""
from __future__ import annotations

import os
import re
from pathlib import Path

KNOWLEDGE_DIR = Path(__file__).resolve().parent.parent / "knowledge"
CHROMA_DIR = Path(__file__).resolve().parent.parent / "data" / "chroma"

_index = None
_fallback_docs: list[tuple[str, str]] | None = None


def _load_fallback_docs() -> list[tuple[str, str]]:
    global _fallback_docs
    if _fallback_docs is not None:
        return _fallback_docs
    docs = []
    if KNOWLEDGE_DIR.exists():
        for p in sorted(KNOWLEDGE_DIR.glob("*.md")):
            docs.append((p.name, p.read_text(encoding="utf-8")))
    _fallback_docs = docs
    return docs


def _simple_search(query: str, top_k: int = 3) -> list[str]:
    docs = _load_fallback_docs()
    tokens = [t for t in re.split(r"[\s，。、？?！!；;：:\n]+", query) if len(t) >= 2]
    scored: list[tuple[float, str, str]] = []
    for name, text in docs:
        score = 0.0
        for t in tokens:
            score += text.count(t) * 2
            score += name.count(t)
        if score > 0:
            # 取相关段落
            paras = [p.strip() for p in text.split("\n\n") if p.strip()]
            best = max(paras, key=lambda p: sum(p.count(t) for t in tokens)) if paras else text[:400]
            scored.append((score, name, best[:600]))
    scored.sort(key=lambda x: -x[0])
    if not scored:
        # 无命中则返回前几篇摘要
        return [f"[{n}]\n{t[:400]}" for n, t in docs[:top_k]]
    return [f"[{n}]\n{snippet}" for _, n, snippet in scored[:top_k]]


def build_index(force: bool = False) -> str:
    """尝试构建向量索引；失败则仅预热关键词索引。"""
    global _index
    _load_fallback_docs()

    api_key = os.getenv("DASHSCOPE_API_KEY") or os.getenv("OPENAI_API_KEY")
    if not api_key:
        return "fallback_keyword"

    try:
        from llama_index.core import SimpleDirectoryReader, VectorStoreIndex, StorageContext, Settings
        from llama_index.core.node_parser import SentenceSplitter
        from llama_index.embeddings.openai import OpenAIEmbedding
        from llama_index.vector_stores.chroma import ChromaVectorStore
        import chromadb

        Settings.embed_model = OpenAIEmbedding(
            model="text-embedding-v3",
            api_base="https://dashscope.aliyuncs.com/compatible-mode/v1",
            api_key=api_key,
        )
        CHROMA_DIR.mkdir(parents=True, exist_ok=True)
        client = chromadb.PersistentClient(path=str(CHROMA_DIR))
        collection = client.get_or_create_collection("xuance_ip_kb")
        vector_store = ChromaVectorStore(chroma_collection=collection)
        storage_context = StorageContext.from_defaults(vector_store=vector_store)

        if force or collection.count() == 0:
            documents = SimpleDirectoryReader(str(KNOWLEDGE_DIR)).load_data()
            splitter = SentenceSplitter(chunk_size=512, chunk_overlap=64)
            _index = VectorStoreIndex.from_documents(
                documents,
                storage_context=storage_context,
                transformations=[splitter],
            )
        else:
            _index = VectorStoreIndex.from_vector_store(vector_store)
        return "llama_chroma"
    except Exception as e:
        print(f"[RAG] LlamaIndex unavailable, using keyword fallback: {e}")
        _index = None
        return "fallback_keyword"


def search_ip_knowledge(query: str, top_k: int = 3) -> list[str]:
    if _index is not None:
        try:
            engine = _index.as_query_engine(similarity_top_k=top_k)
            resp = engine.query(query)
            # 优先取 source nodes
            hits = []
            if hasattr(resp, "source_nodes"):
                for n in resp.source_nodes[:top_k]:
                    hits.append(n.get_content()[:600])
            if hits:
                return hits
            return [str(resp)]
        except Exception as e:
            print(f"[RAG] query failed: {e}")
    return _simple_search(query, top_k=top_k)
