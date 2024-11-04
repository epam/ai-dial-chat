import { CODEAPPS_REQUIRED_FILES } from './applications';

export enum ExampleTypes {
  HELLO_WORLD = 'Hello world',
  SIMPLE_RAG = 'Simple RAG',
  REQUIREMENTS = 'requirements.txt',
}

const REQUIREMENTS_EXAMPLE = {
  [CODEAPPS_REQUIRED_FILES.REQUIREMENTS]: `aidial-sdk==0.1.2
requests`,
};

const HELLO_WORLD_EXAMPLE = {
  [CODEAPPS_REQUIRED_FILES.REQUIREMENTS]: `aidial-sdk==0.1.2
requests`,
  [CODEAPPS_REQUIRED_FILES.APP]: `import uvicorn
import requests
import os

from aidial_sdk import DIALApp
from aidial_sdk.chat_completion import ChatCompletion, Request, Response
import subprocess

# ChatCompletion is an abstract class for applications and model adapters
class EchoApplication(ChatCompletion):
    async def chat_completion(
        self, request: Request, response: Response
    ) -> None:
        # Get last message (the newest) from the history
        last_user_message = request.messages[-1]

        # response2 = requests.get(os.getenv('DIAL_URL') + '/v1/bucket', headers={
        #     'api-key': request.headers.get('api-key')
        # })

        #result = subprocess.run('ip -a address show', shell=True, capture_output=True, text=True)
        #result = subprocess.run('ping 8.8.8.8 -c 5', shell=True, capture_output=True, text=True)
        #result = subprocess.run('apt update & apt install -y netcat-openbsd', shell=True, capture_output=True, text=True)
        #str_result = f"{result}"

        #response_time = ping('example.com')
        #msg = f'Response time: {response_time} ms'

        with response.create_single_choice() as choice:
            #print(msg)
            #print("test: " + request.headers.get('Host'))
            # Fill the content of the response with the last user's content
            #choice.append_content(last_user_message.content or "")
            #choice.append_content(str_result)
            choice.append_content(request.headers.get('Host') or "NONE")
            #choice.append_content(msg)


# Verbose ping with multiple requests
#verbose_ping('google.com', count=4)
# x = verbose_ping('8.8.8.8', count=4)
# print(x)

#DIAL App extends FastAPI to provide an user-friendly interface for routing requests to your applications
app = DIALApp()
app.add_chat_completion("echo", EchoApplication())

#Run builded app
if __name__ == "__main__":
  uvicorn.run(app, port=5000, host="0.0.0.0")
`,
};

const SIMPLE_RAG_EXAMPLE = {
  [CODEAPPS_REQUIRED_FILES.APP]: `"""
A simple RAG application based on LangChain.
"""

import os
from urllib.parse import urljoin
from uuid import uuid4

import uvicorn
from langchain.callbacks.base import AsyncCallbackHandler
from langchain.chains.retrieval_qa.base import RetrievalQA
from langchain.embeddings import CacheBackedEmbeddings
from langchain.globals import set_debug
from langchain.storage import LocalFileStore
from langchain_community.document_loaders import PyPDFLoader, WebBaseLoader
from langchain_community.vectorstores import Chroma
from langchain_openai import AzureChatOpenAI, AzureOpenAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from utils import get_last_attachment_url, sanitize_namespace

from aidial_sdk import DIALApp
from aidial_sdk import HTTPException as DIALException
from aidial_sdk.chat_completion import ChatCompletion, Choice, Request, Response


def get_env(name: str) -> str:
    value = os.getenv(name)
    if value is None:
        raise ValueError(f"Please provide {name!r} environment variable")
    return value


DIAL_URL = get_env("DIAL_URL")
EMBEDDINGS_MODEL = os.getenv("EMBEDDINGS_MODEL", "text-embedding-ada-002")
CHAT_MODEL = os.getenv("CHAT_MODEL", "gpt-4")
API_VERSION = os.getenv("API_VERSION", "2024-02-01")
LANGCHAIN_DEBUG = os.getenv("LANGCHAIN_DEBUG", "false").lower() == "true"

set_debug(LANGCHAIN_DEBUG)

text_splitter = RecursiveCharacterTextSplitter.from_tiktoken_encoder(
    chunk_size=256, chunk_overlap=0
)

embedding_store = LocalFileStore("./~cache/")


class CustomCallbackHandler(AsyncCallbackHandler):
    def __init__(self, choice: Choice):
        self._choice = choice

    async def on_llm_new_token(self, token: str, *args, **kwargs) -> None:
        self._choice.append_content(token)


class SimpleRAGApplication(ChatCompletion):
    async def chat_completion(
        self, request: Request, response: Response
    ) -> None:
        collection_name = str(uuid4())

        with response.create_single_choice() as choice:
            message = request.messages[-1]
            user_query = message.text()

            file_url = get_last_attachment_url(request.messages)
            file_abs_url = urljoin(f"{DIAL_URL}/v1/", file_url)

            if file_abs_url.endswith(".pdf"):
                loader = PyPDFLoader(file_abs_url)
            else:
                loader = WebBaseLoader(file_abs_url)

            # Create the download stage to show to the user the active process.
            # After the loading is complete, the stage will auto finished.
            with choice.create_stage("Downloading the document"):
                try:
                    documents = loader.load()
                except Exception:
                    msg = "Error while loading the document. Please check that the URL you provided is correct."
                    raise DIALException(
                        status_code=400, message=msg, display_message=msg
                    )

            # Show the user the total number of parts in the resource
            with choice.create_stage(
                "Splitting the document into chunks"
            ) as stage:
                texts = text_splitter.split_documents(documents)
                stage.append_content(f"Total number of chunks: {len(texts)}")

            # Show the user start of calculating embeddings stage
            with choice.create_stage("Calculating embeddings"):

                openai_embedding = AzureOpenAIEmbeddings(
                    model=EMBEDDINGS_MODEL,
                    azure_deployment=EMBEDDINGS_MODEL,
                    azure_endpoint=DIAL_URL,
                    # Header propagation automatically propagates the API key from the request headers.
                    openai_api_key="-",
                    openai_api_version=API_VERSION,
                    # The check leads to tokenization of the input strings.
                    # Tokenized input is only supported by OpenAI embedding models.
                    # For other models, the check should be disabled.
                    check_embedding_ctx_length=False,
                )

                embeddings = CacheBackedEmbeddings.from_bytes_store(
                    openai_embedding,
                    embedding_store,
                    namespace=sanitize_namespace(openai_embedding.model),
                )

                docsearch = Chroma.from_documents(
                    texts, embeddings, collection_name=collection_name
                )

            # CustomCallbackHandler allows to pass tokens to the users as they are generated, so as not to wait for a complete response.
            llm = AzureChatOpenAI(
                azure_deployment=CHAT_MODEL,
                azure_endpoint=DIAL_URL,
                # Header propagation automatically propagates the API key from the request headers.
                openai_api_key="-",
                openai_api_version=API_VERSION,
                temperature=0,
                streaming=True,
                callbacks=[CustomCallbackHandler(choice)],
            )

            await response.aflush()

            qa = RetrievalQA.from_chain_type(
                llm=llm,
                chain_type="stuff",
                retriever=docsearch.as_retriever(search_kwargs={"k": 15}),
            )

            await qa.ainvoke({"query": user_query})

            docsearch.delete_collection()


app = DIALApp(DIAL_URL, propagate_auth_headers=True)
app.add_chat_completion("simple-rag", SimpleRAGApplication())


if __name__ == "__main__":
    uvicorn.run(app, port=5000)
`,
  [CODEAPPS_REQUIRED_FILES.REQUIREMENTS]: `aidial-sdk>=0.10
langchain==0.2.10
langchain-community==0.2.9
langchain-openai==0.1.17
langchain-text-splitters==0.2.2
tiktoken==0.7.0
openai==1.35.15
beautifulsoup4==4.12.3
chromadb==0.5.4
uvicorn==0.30.1
pypdf==4.3.0`,
  'utils.py': `from typing import List

from aidial_sdk import HTTPException as DIALException
from aidial_sdk.chat_completion import Message


def sanitize_namespace(namespace: str) -> str:
    return "".join(c if c.isalnum() or c in "._-/" else "-" for c in namespace)


def get_last_attachment_url(messages: List[Message]) -> str:
    for message in reversed(messages):
        if (
            message.custom_content is not None
            and message.custom_content.attachments is not None
        ):
            attachments = message.custom_content.attachments

            if attachments == []:
                continue

            if len(attachments) != 1:
                msg = "Only one attachment per message is supported"
                raise DIALException(
                    status_code=422,
                    message=msg,
                    display_message=msg,
                )

            attachment = attachments[0]

            url = attachment.url
            if url is None:
                msg = "Attachment is expected to be provided via a URL"
                raise DIALException(
                    status_code=422,
                    message=msg,
                    display_message=msg,
                )

            return url

    msg = "No attachment was found"
    raise DIALException(
        status_code=422,
        message=msg,
        display_message=msg,
    )
`,
};

export const CODE_APPS_EXAMPLES = {
  [ExampleTypes.REQUIREMENTS]: REQUIREMENTS_EXAMPLE,
  [ExampleTypes.HELLO_WORLD]: HELLO_WORLD_EXAMPLE,
  [ExampleTypes.SIMPLE_RAG]: SIMPLE_RAG_EXAMPLE,
};
