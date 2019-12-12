import aiohttp
import asyncio
import ssl
import certifi
import time
import difflib

from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode
from pymemcache.client import base
from bs4 import BeautifulSoup

SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())
TIME_TO_WAIT = 1000000000 # 1 second in nanoseconds
HEADERS = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/73.0.3683.75 Safari/537.36",
           "Connection": "keep-alive", 'Accept': '*/*'}
CACHE = base.Client(('localhost', 11211))

QUEUE = []

TOTAL_COMPLETE = 0

async def fetch(session, url):
    async with session.get(url, ssl=SSL_CONTEXT) as response:
        return await response.text()

async def main():
    #await follow_redirects({"url": "http://untp.beer/s/b295660756"})
    #await strip_params({"url": "https://www.google.com/search?source=hp&ei=r43yXYb7CI-3tAbmw7LwBg&q=hello+world&oq=hello+world&gs_l=psy-ab.3..0l10.68.1064..1168...0.0..0.148.837.8j2......0....1..gws-wiz.......0i131.zNuiCRaD934&ved=0ahUKEwjGjreT5bDmAhWPG80KHeahDG4Q4dUDCAg&uact=5"})
    
    make_queue("todo/results0.tsv")

    tasks = []
    for i in range(50):
        task = asyncio.create_task(go())
        tasks.append(task)

    await asyncio.gather(*tasks)

async def go():
    global TOTAL_COMPLETE

    entry = url_from_queue()
    if entry:
        try:
            entry = await follow_redirects(entry)
        except Exception as e:
            print("Something went wrong with " + entry["url"])
        
        try:
            entry = await strip_params(entry)
        except Exception as e:
            print("Something went wrong with " + entry["url"])
        print("going again...")
        TOTAL_COMPLETE += 1
        print("\n~~WE HAVE COMPLETED " + str(TOTAL_COMPLETE) + "\n")
        await go() # do it all again
    else:
        print("The queue is empty")

def make_queue(filename):
    global QUEUE

    print("building queue...")
    with open(filename, "r") as fp:
        for ctr, url in enumerate(fp):
            url = url.strip()
            entry = {"url": url, "orig_url": url}
            #print("Adding " + url + " to queue")
            QUEUE.append(entry)
    print("queue built")

def url_from_queue():
    global QUEUE

    try:
        return QUEUE.pop()
    except NameError:
        return None

async def get_content(url):
    async with aiohttp.ClientSession() as session:
        resp,body = await hit_url(session=session, 
                            url=url,
                            method="GET")
        return body

async def follow_redirects(entry):
    print("URL: " + entry["url"])

    async with aiohttp.ClientSession() as session:
        resp, body = await hit_url(session=session, 
                                   url=entry["url"],
                                   method="HEAD")

        if "Location" in resp.headers and resp.status >= 300 and resp.status < 400:
            new_url = resp.headers["Location"]
            entry["url"] = new_url
            return await follow_redirects(entry)
        else:
            return entry

async def strip_params(entry):
    entry["content"] = await get_content(entry["url"])
    parsed_url = urlparse(entry["url"])
    params = parse_qsl(parsed_url.query)
    parsed_url = parsed_url._replace(query="")
    entry["url"] = urlunparse(parsed_url)
    await strip_params_helper(entry, params)

async def strip_params_helper(entry, params):
    params_to_keep = []
    content = entry["content"]
    parsed_url = urlparse(entry["url"])

    for i in range(len(params)):
        params_to_use = params[i+1:] + params_to_keep
        print(params_to_use)
        query_str = urlencode(params_to_use)
        print(query_str)
        parsed_url = parsed_url._replace(query=query_str)
        new_url = urlunparse(parsed_url)
        print("THE URL WE ARE TRYING: " + new_url)
        new_content = await get_content(new_url)

        if webpages_different(content, new_content):
            params_to_keep.append(params[i])
        else:
            print("Param " + params[i][0] + " is not needed!")

    parsed_url = parsed_url._replace(query=urlencode(params_to_keep))
    entry["url"] = urlunparse(parsed_url)
    print("The resulting URL: " + entry["url"])
    return entry

def webpages_different(x, y):
    """
    Implements the url_light logic for distinguishing two versiosn of a webpage.
    
    Returns True if
        * the two versions have different titles and differ by more than 2%
        * the two versions have the same titles and differ by more than 95%
    
    For efficiency, this uses `quick_ratio()` rather than the more accurate but 
    considerably slower `ratio()`.
    """
    x_title = BeautifulSoup(x, "lxml").title
    y_title = BeautifulSoup(y, "lxml").title

    diff = difflib.SequenceMatcher(None, x, y).quick_ratio()
    if (diff < 0.98 and x_title != y_title) or diff < 0.05:
        return True
    return False
        
async def hit_url(session, url, method="GET", allow_redirects=False, config={}):
    config["url"] = url
    config["method"] = method
    config["allow_redirects"] = allow_redirects
    config["headers"] = HEADERS

    time_of_last_access = last_accessed(url)
    if(time.time_ns() - time_of_last_access > TIME_TO_WAIT):
        try:
            update_access_logs(url)
            async with session.request(**config, ssl=SSL_CONTEXT) as resp:
                body = await resp.text()
                return (resp, body)
        except Exception as e:
            print("Raising exception ourselves!")
            raise(e)
            return [None, None]
    else:
        await asyncio.sleep(1) # todo: maybe sleep fancier
        return await hit_url(session, url, method, allow_redirects, config)

def last_accessed(url):
    #print("CHECKING ACCESS FOR ")
    #print(url)
    parsed = urlparse(url)
    domain = parsed.netloc
    return int(CACHE.get(domain, 0))

def update_access_logs(url):
    parsed = urlparse(url)
    domain = parsed.netloc
    CACHE.set(domain, time.time_ns(), 5) # clear this entry after 5 seconds

if __name__ == '__main__':
    #loop = asyncio.get_event_loop()
    #loop.run_until_complete(main())
    asyncio.run(main())