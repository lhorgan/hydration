import requests
import os
import random
import time
import difflib
import random
import csv
import sys

from multiprocessing import Process, Queue, Lock, Manager
from urllib.parse import urlparse
from urllib import parse
from bs4 import BeautifulSoup

PING_INT = 10000000 # 1/100th of a second

def follow_redirects_consumer(redirects_q, followed_q, access_stats):
    for i in range(1, 5):
        url, rid = redirects_q.get()
        o = urlparse(url)
        domain = o.netloc
        if safe_to_access(domain):
            r = requests.head(url, allow_redirects=False)
            access_stats[domain] = time.time_ns()
            if r.headers["location"] == url:
                # we're done with this one
                followed_q.put((r.headers["location"], rid))
            else:
                redirects_q.put((r.headers["location"], rid))
        else:
            redirects_q.put((url, rid)) # put it right back for safe keeping

        time.sleep(0.05) # sleep for 50 milliseconds


def followed_consumer(followed_q, params_q, access_stats):
    while True:
        url, rid = followed_q.get()
        o = urlparse(url)
        params = parse.parse_qs(o.query)
        if(len(params) > 0):
            domain = o.netloc
            can_hit = safe_to_access(domain, access_stats)
            if can_hit:
                r = requests.get(url)
                access_stats[domain] = time.time_ns()
                if r.status_code == 200:
                    params_q.put(({"params": params, "url": url.split('?', maxsplit=1)[0], "text": r.text}, rid))
                else:
                    followed_q.put((url, rid))
        else:
            print("COMPLETED " + url + " AT ROW " + rid)
            # we're done
    
        time.sleep(0.05)

def params_consumer(params_q, access_stats):
    while True:
        entry, rid = params_q.get()
        url = entry["url"]
        params = entry["params"]
        text = entry["text"]

        if len(params) == 0:
            print("COMPLETED " + url + " AT ROW " + rid + " WITH PARAMS POST PROCESSING")
            continue

        # randomly pick a parameter to ignore
        # see if it changes things
        param_to_remove = random.choice(list(params.keys()))
        del params[param_to_remove]

        req = PreparedRequest()
        req.prepare_url(url, params)
        new_url = req.url # url, plus the parameters we added

        o = urlparse(url)
        domain = o.netloc
        can_hit = safe_to_access(domain, access_stats)

        if can_hit:
            r = requests.get(new_url)
            access_stats[domain] = time.time_ns()
            changed = webpages_different(text, r.text)
            if changed: # a change was detected
                req.prepare_url(url, param_to_remove)
                # param_to_remove has been identified as necessary
                params_q.put(({"params": params, "url": req.url}, rid)) # URL now contains the removed param as a permanent fixture
            else:
                params_q.put(({"params": params, "url": url}, rid))

        time.sleep(0.05)

def safe_to_access(domain, access_stats):
    """
    Determines whether or not we can access a URL without getting blocked

    Returns True if it's been more than PING_INT nanoseconds since we last pinged the domain,
    False otherwise
    """

    if domain in access_stats:
        last_access = access_stats[domain]
        if time.time_ns() - last_access >= PING_INT:
            return True
    else:
        return True
    
    return False

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

def main():
    with open('urls.tsv','r') as tsvin:
        tsvin = csv.reader(tsvin, delimiter='\t')

        redirects_q = Queue()
        followed_q = Queue()
        params_q = Queue()

        rid = 0
        for row in tsvin:
            url = row[0]
            params_q.put((rid, url))

            if rid >= 5:
                break
    
    print("MADE IT HERE")
    with Manager() as manager:
        access_stats = manager.dict()
        
        p1 = Process(target=follow_redirects_consumer, args=(redirects_q, followed_q, manager))
        p1.daemon = True
        print("STARTING P1")
        p1.start()

        # p2 = Process(target=followed_consumer, args=(followed_q, params_q, access_stats))
        # p2.daemon = True
        # p2.start()

        # p3 = Process(target=params_consumer, args=(params_q, access_stats))
        # p3.daemon = True
        # p3.start()

        p1.join()
        # p2.join()
        # p3.join()