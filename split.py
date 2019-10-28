import os
import random

from csv import reader

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
        f = open("%s/results%i.tsv" % (results_folder, i), "w+")
        for url in urls:
            f.write("%s\r\n" % url)
        f.close()
        i += 1

def repair(results_filename, input_filename):
    # Here's the program
    # 1: Find all the URLs in input that have a comma and split them at their first comma
    # 2: Loop through URLs in results and remove any that start like the URLs we found in step 1
    # 3: Write the list generated in step 2 to a new file with tab separators
    comma_urls = set()

    # Step 1
    f = open(input_filename, "r")
    url = f.readline()
    while(url):
        url = url.strip()
        comma_index = url.find(",")
        if comma_index > 0:
            comma_urls.add(url[:comma_index])
        
        url = f.readline()
    f.close()

    print("I found " + str(len(comma_urls)) + " urls with commas.")

    # Steps 2 and 3
    new_results = []
    f = open(results_filename, "r")
    line = f.readline()
    while(line):
        comma_url = line.split(",")[0] # POTENTIAL comma URL
        if comma_url in comma_urls:
            print(comma_url + " is a comma URL")
        else:
            new_results.append(line)
    f.close()

    f = open("fixed.tsv", "w+")
    for line in reader(new_results):
        f.write("\t".join(line) + "\r\n")
    f.close()