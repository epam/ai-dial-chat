# GPT World 

This application producing answer based on the curated set of LLM related publications from [arxiv.org](https://arxiv.org).

GPT World is classic example of conversational semantic search application.
On every new user question, it performs summarization using GPT-4, calculates embedding using text-embedding-ada-002 model and then it uses chunks of text from curated set.

This is DIAL version of the [original demo](https://deltix.io/interactive-gpt-world-map.html) with [TSNE map](https://en.wikipedia.org/wiki/T-distributed_stochastic_neighbor_embedding).

# Echo 

This demo application simply repeats back user's input.

# Ask EPAM Pre-sales
(Former EPAM10K Semantic Search App)

This application was specially designed to help pre-sales team with filling compliance form. It always answers to the last user's question ignoring previous history.

Internally it utilizes information from the most recent [10K-form](https://investors.epam.com/investors/sec-filings) and other pre-sales documents. 
Every user question is rephrased with GPT-4, then we perform search of the closest passage using [e5-large-v2](https://huggingface.co/intfloat/e5-large-v2) model. Finally, GPT-4 synthesizes the answers.

# EPAM Pre-sales FAQ
(Former EPAM10K Golden QnA App)

This application is designed to provide curated answers from the pre-sales FAQ documents. 

It uses [e5-large-v2](https://huggingface.co/intfloat/e5-large-v2) embeddings to identify related questions. And then uses GPT-4 to identify if user question could be fully answered with one of the FAQ entries.

# EPAM Pre-sales FAQ+Search
(Former EPAM10K)
This application is combination of “EPAM pre-sales FAQ” and “Ask EPAM pre-sales”. 

It first tries to find curated answer and if it fails, it allows GPT-4 to synthesize reply. It implements hybrid hallucination-suppression solution described [here](https://epam-rail.com/custom-framework).

# Pre-Sales Assistant

Assistant that answers pre-sales question about EPAM. It is instructed not to help with unrelated questions. 

Unlike applications which can contain arbitrary logic, in case of assistant LLM drives conversation and decides what steps needs to be done. It utilizes “EPAM Pre-sales Semantic Search” and “EPAM Pre-Sales FAQ Search” addons to complete the task. 

# Wolfram
Addon that provides access to the computation, math, curated knowledge & real-time data through Wolfram|Alpha and Wolfram Language.

# EPAM Pre-sales Search Addon
(Former EPAM 10K Semantic Search (Addon))
Addon that allows LLM to search over pre-sales documents. 

# EPAM Pre-Sales FAQ Addon
(Former EPAM10K Golden QNA (Addon))
Addon than allows LLM to search answer in the pre-sales FAQ. 
