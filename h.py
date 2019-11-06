import requests
import os
import random
import time
import difflib
import random
import csv
import sys
import signal

from multiprocessing import Process, Queue, JoinableQueue, Lock, Manager, current_process
from urllib.parse import urlparse
from urllib import parse
from bs4 import BeautifulSoup
from requests.models import PreparedRequest

PING_INT = 10000000 # 1/100th of a second
GO = 10

def follow_redirects_consumer(redirects_q, followed_q, complete_q, access_stats, stop):
    while True:
        #print(current_process().name)
        try:
            url, rid, orig_url = redirects_q.get(True, 0.01)
        except:
            continue
        #print("URL: %s" % url)
        #print("RID: %i" % rid)
        o = urlparse(url)
        domain = o.netloc
        if safe_to_access(domain, access_stats):
            try:
                access_stats[domain] = time.time_ns()
                r = requests.head(url, allow_redirects=False)

                if "Location" in r.headers:
                    if r.headers["Location"] == url:
                        # we're done with this one
                        followed_q.put((r.headers["Location"], rid, orig_url))
                    else:
                        redirects_q.put((r.headers["Location"], rid, orig_url))
                else:
                    #print("No location specified in header... assuming this one is done")
                    followed_q.put((r.url, rid, orig_url))
            except:
                #print("Error with " + url)
                redirects_q.put((url, rid, orig_url))
        else:
            redirects_q.put((url, rid, orig_url)) # put it right back for safe keeping

        time.sleep(0.05) # sleep for 50 milliseconds

    print("follow_redirects_consumer done")


def followed_consumer(followed_q, params_q, complete_q, access_stats, stop):
    while True:
        try:
            url, rid, orig_url = followed_q.get(True, 0.01)
        except:
            continue
        #print("HANDLING URL " + url)
        o = urlparse(url)
        params = parse.parse_qs(o.query)
        if(len(params) > 0):
            #print("LENGTH OF PARAMS IS " + str(len(params)))
            domain = o.netloc
            can_hit = safe_to_access(domain, access_stats)
            if can_hit:
                try:
                    access_stats[domain] = time.time_ns()
                    r = requests.get(url)

                    if r.status_code == 200:
                        params_q.put(({"params": params, "url": url.split('?', maxsplit=1)[0], "text": r.text}, rid, orig_url))
                    else:
                        followed_q.put((url, rid, orig_url))
                except:
                    followed_q.put((url, rid, orig_url))
                    #print("Error with " + url)
            else:
                followed_q.put((url, rid, orig_url))
        else:
            #print("COMPLETED " + url + " AT ROW " + str(rid))
            complete_q.put((url, rid, orig_url))
            # we're done
    
        time.sleep(0.05)
    
    print("followed_consumer done")

def params_consumer(params_q, complete_q, access_stats, stop):
    #print(stop.value)
    while True:
        try:
            entry, rid, orig_url = params_q.get(True, 0.01)
        except:
            continue
        url = entry["url"]
        params = entry["params"]
        text = entry["text"]

        #print("PARAMS HANDLER " + url + ", " + str(len(params)))

        if len(params) == 0:
            #print("PARAMS COMPLETED " + url + " AT ROW " + str(rid) + " WITH PARAMS POST PROCESSING")
            complete_q.put((url, rid, orig_url))
            continue
        
        o = urlparse(url)
        domain = o.netloc
        can_hit = safe_to_access(domain, access_stats)

        if can_hit:
            # randomly pick a parameter to ignore
            # see if it changes things
            param_to_remove = random.choice(list(params.keys()))
            param_to_remove_val = params[param_to_remove]
            del params[param_to_remove]

            req = PreparedRequest()
            req.prepare_url(url, params)
            new_url = req.url # url, plus the parameters we added
        
            try:
                access_stats[domain] = time.time_ns()
                r = requests.get(new_url)

                changed = webpages_different(text, r.text)
                if changed: # a change was detected
                    #print("DETECTED A CHANGE")
                    req.prepare_url(url, {param_to_remove: param_to_remove_val})
                    # param_to_remove has been identified as necessary
                    params_q.put(({"params": params, "url": req.url, "text": text}, rid, orig_url)) # URL now contains the removed param as a permanent fixture
                else:
                    #print("NO CHANGE DETECTED")
                    params_q.put(({"params": params, "url": url, "text": text}, rid, orig_url))
            except:
                #print("Error with " + url)
                params_q.put((entry, rid))
        else:
            params_q.put((entry, rid))

        time.sleep(0.05)
    print("params_consumer done")

def csv_consumer(complete_q, stop):
    with open("results.csv", "a+") as results:
        while True:
            try:
                url, rid, orig_url = complete_q.get(True, 0.01)
            except:
                continue
            results.write("%s,%s,%s\n" % (orig_url, url, rid))
            time.sleep(0.05)
    
    print("csv_consumer done")

def safe_to_access(domain, access_stats):
    """
    Determines whether or not we can access a URL without getting blocked

    Returns True if it's been more than PING_INT nanoseconds since we last pinged the domain,
    False otherwise
    """

    #print(access_stats)

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

def producer_thread(redirects_q, stop):
    c = True
    def handler3(sig, frame):
        c = False

    signal.signal(signal.SIGTERM, handler3)

    print("PRODUCER")

    f = open('urls.tsv','r')

    rid = 0
    while True:
        url = f.readline().strip()
        redirects_q.put((url, rid, url))
        rid += 1
        time.sleep(0.005)
    f.close()

def handler(signum, frame):
    print("ignoring")
signal.signal(signal.SIGINT, handler)

if __name__ == '__main__':
    redirects_q = Queue()
    followed_q = Queue()
    params_q = Queue()
    complete_q = Queue()

    manager = Manager()
    access_stats = manager.dict()
    stop = manager.Value('stop', False)

    prod = Process(target=producer_thread, args=(redirects_q,stop))
    #prod.daemon = True
    #prod.start()

    threads = []
    for i in range(0, 3):
        p1 = Process(target=follow_redirects_consumer, args=(redirects_q, followed_q, complete_q, access_stats, stop))
        #p1.daemon = True
        #p1.start()

        p2 = Process(target=followed_consumer, args=(followed_q, params_q, complete_q, access_stats, stop))
        #p2.daemon = True
        #p2.start()

        p3 = Process(target=params_consumer, args=(params_q, complete_q, access_stats, stop))
        #p3.daemon = True
        #p3.start()

        threads.append((p1, p2, p3))

    csv_c = Process(target=csv_consumer, args=(complete_q, stop))
    #csv_c.daemon = True
    #csv_c.start()

    prod.start()
    csv_c.start()
    for p1,p2,p3 in threads:
        p1.start()
        p2.start()
        p3.start()

    def handler2(signum, frame):
        print("main not ignoring fyi")
        for p1,p2,p3 in threads:
            p1.terminate()
            p2.terminate()
            p3.terminate()
        prod.terminate()
        csv_c.terminate()
    signal.signal(signal.SIGINT, handler2)

    # def handler(signum, frame):
    #     print("STOPPING (from %s)" % current_process().name)
    #     stop.set(True)

    # print("Adding signal listener")
    # signal.signal(signal.SIGINT, handler)
    
    prod.join()
    csv_c.join()
    for p1,p2,p3 in threads:
        p1.join()
        p2.join()
        p3.join()
