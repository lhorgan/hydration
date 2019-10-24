import os
import random

def split(filename, results_folder, file_num):
    if not os.path.exists(results_folder):
        os.makedirs(results_folder)

    urls_file = open(filename, "r")
    url = urls_file.readline()

    results = [[] for i in range(file_num)]
    all_urls = []

    while url:
        url = url.strip()
        all_urls.append(url)
        url = urls_file.readline()
    
    urls_file.close()

    random.shuffle(all_urls)
    for url in all_urls:
        results[random.choice(range(0, file_num))].append(url)
    
    i = 0
    for urls in results:
        f = open("%s/results%i.csv" % (results_folder, i), "w+")
        for url in urls:
            f.write("%s\r\n" % url)
        f.close()
        i += 1
            

