import time
import multiprocessing

from multiprocessing import Process, Queue, JoinableQueue, Lock, Manager
 
def thread(q):
    for i in range(1, 10000):
        pass
 
def main():
    q = Queue()

    threads = []
    for x in range(0, 20):
        p1 = Process(target=thread, args=(q,))
        p1.daemon = True
        p1.start()
        threads.append(p1)

    for x in range(0, 20):
        print("JOINING!")
        threads[x].join()
    print("WEEE, we are done")