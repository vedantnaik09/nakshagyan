"use client";
import React, { useEffect, useRef, useState, Suspense, useCallback } from "react";
import { firestore, firebase } from "../../firebaseConfig";
import dynamic from "next/dynamic";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import toast from "react-hot-toast";

type OfferAnswerPair = {
  offer: {
    sdp: string | null;
    type: RTCSdpType;
  } | null;
  answer: {
    sdp: string | null;
    type: RTCSdpType;
  } | null;
};

type Message = {
  text: string;
  sender: number;
  timestamp: Date;
};

const Page = () => {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [inCall, setInCall] = useState(false);
  const [callId, setCallId] = useState<string>();
  const [isHost, setIsHost] = useState(false);
  const callButtonRef = useRef<HTMLButtonElement>(null);
  const callInputRef = useRef<HTMLInputElement>(null);
  const answerButtonRef = useRef<HTMLButtonElement>(null);
  const hangupButtonRef = useRef<HTMLButtonElement>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState("");
  const [dataChannels, setDataChannels] = useState<RTCDataChannel[]>([]);

  const [pcs, setPcs] = useState<RTCPeerConnection[]>([]);
  const [myIndex, setMyIndex] = useState<number>();
  const [chatIndex, setChatIndex] = useState<number>();
  const [nameList, setNameList] = useState<string[]>();

  const [beforeCall, setBeforeCall] = useState(0);
  const [afterCall, setAfterCall] = useState(0);
  const [callLeft, setCallLeft] = useState(0);

  const setupPeerConnection = (pc: RTCPeerConnection) => {
    // Create data channel
    const dataChannel = pc.createDataChannel("messageChannel");
    setupDataChannel(dataChannel);
    setDataChannels(prev => [...prev, dataChannel]);

    // Handle incoming data channels as well
    pc.ondatachannel = (event) => {
      const incomingChannel = event.channel;
      setupDataChannel(incomingChannel);
      setDataChannels(prev => [...prev, incomingChannel]);
    };

    return pc;
  };

  const setupDataChannel = (dataChannel: RTCDataChannel) => {
    console.log("setup data channel")
    dataChannel.onmessage = (event) => {
      const message = JSON.parse(event.data);
      setMessages(prev => [...prev, message]);
      console.log(messages)
    };

    dataChannel.onopen = () => {
      console.log("Data channel is open");
    };

    dataChannel.onclose = () => {
      console.log("Data channel is closed");
      setDataChannels(prev => prev.filter(dc => dc !== dataChannel));
    };

    dataChannel.onerror = (error) => {
      console.error("Data Channel Error:", error);
    };
  };

  const generateShortId = () => {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < 5; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  };
  const servers = {
    iceServers: [
      {
        urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
      },
    ],
    iceCandidatePoolSize: 10,
  };

  const handleCallButtonClick = async () => {
    setInCall(true);
    if (hangupButtonRef.current) hangupButtonRef.current.disabled = false;
    const shortId = generateShortId();
    const callDoc = firestore.collection("calls").doc(shortId);
    let indexOfOtherConnectedCandidates = callDoc.collection("otherCandidates").doc(`indexOfConnectedCandidates`);
    const screenshotDoc = callDoc.collection("screenshotSignal").doc("screenshotSignalDocument");

    await setCallId(shortId);
    replace(`${pathname}?id=${callDoc.id}`);

    await indexOfOtherConnectedCandidates.set({ indexOfCurrentUsers: [1] });
    if (callInputRef.current) {
      callInputRef.current.value = callDoc.id;
    }
    await callDoc.set({
      connectedUsers: 1,
      screenSharer: -1,
      loading: false,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(), // Timestamp added here
    });
    await screenshotDoc.set({ screenshotSignal: 1 });

    const myIndex = 1;
    setMyIndex(myIndex);
    setChatIndex(1)
    setIsHost(true);
    let pc: RTCPeerConnection;
    indexOfOtherConnectedCandidates.onSnapshot(async (doc) => {
      if (doc.exists) {
        //Check for any newly addded users
        if (
          doc.data()?.indexOfCurrentUsers[doc.data()?.indexOfCurrentUsers.length - 1] != myIndex &&
          doc.data()?.indexOfCurrentUsers[doc.data()?.indexOfCurrentUsers.length - 1] &&
          doc.data()?.indexOfCurrentUsers[doc.data()?.indexOfCurrentUsers.length - 1] > myIndex
        ) {
          const newAddedUser = doc.data()?.indexOfCurrentUsers[doc.data()?.indexOfCurrentUsers.length - 1];
          let signalDoc = callDoc.collection("signal").doc(`signal${newAddedUser}${myIndex}`);
          console.log(`${newAddedUser} added`);
          console.log(`${myIndex} myIndex`);
          await signalDoc.set({
            userAdded: `${newAddedUser} added`,
            signal: 0,
          });
          let offerAnswerPairs: firebase.firestore.DocumentReference<firebase.firestore.DocumentData>;
          let offerCandidatesCollection: firebase.firestore.CollectionReference<firebase.firestore.DocumentData>;
          let answerCandidatesCollection: firebase.firestore.CollectionReference<firebase.firestore.DocumentData>;
          let candidateNameDoc: firebase.firestore.DocumentReference<firebase.firestore.DocumentData>;
          signalDoc.onSnapshot(async (doc) => {
            if (doc.exists) {
              const data = doc.data();
              const signal = data?.signal;
              if (signal === 0) {
                pc = new RTCPeerConnection(servers);
                pc = setupPeerConnection(pc);
                candidateNameDoc = callDoc.collection("otherCandidates").doc(`candidate${newAddedUser}${myIndex}`);
                candidateNameDoc.set({ myName: "Moderator", joiner: "" });

                offerCandidatesCollection = callDoc.collection("otherCandidates").doc(`candidate${newAddedUser}${myIndex}`).collection("offerCandidates");
                answerCandidatesCollection = callDoc.collection("otherCandidates").doc(`candidate${newAddedUser}${myIndex}`).collection("answerCandidates");
                pc.onicecandidate = async (event) => {
                  event.candidate && (await offerCandidatesCollection.add(event.candidate.toJSON()));
                };
                offerAnswerPairs = callDoc.collection("otherCandidates").doc(`offerAnswerPairs${newAddedUser}${myIndex}`);

                pc.onicecandidate = async (event) => {
                  event.candidate && (await offerCandidatesCollection.add(event.candidate.toJSON()));
                };

                const offerDescription = await pc.createOffer();
                await pc.setLocalDescription(offerDescription);

                let offer = {
                  sdp: offerDescription.sdp as string,
                  type: offerDescription.type,
                };

                let offerAnswerPair: OfferAnswerPair = {
                  offer: offer,
                  answer: null,
                };

                const currentPairs: OfferAnswerPair[] = (await offerAnswerPairs.get()).data()?.offerAnswerPairs || [];

                await currentPairs.push(offerAnswerPair);
                console.log(currentPairs);
                await offerAnswerPairs.set({
                  offerAnswerPairs: currentPairs,
                });
                await signalDoc.set({ signal: 1 });
              } else if (signal == 2) {
                const answerDescription = new RTCSessionDescription((await offerAnswerPairs.get()).data()?.offerAnswerPairs[0].answer);
                console.log("Data on receiver is ", (await offerAnswerPairs.get()).data()?.offerAnswerPairs[0].answer);
                await pc.setRemoteDescription(answerDescription);

                await answerCandidatesCollection.onSnapshot(
                  async (snapshot) => {
                    await snapshot.docChanges().forEach(async (change) => {
                      if (change.type === "added") {
                        const candidateData = change.doc.data();
                        const candidate = new RTCIceCandidate(candidateData);
                        await pc
                          .addIceCandidate(candidate)
                          .then(() => {
                            console.log("Ice candidate added successfully");
                          })
                          .catch((error) => {
                            console.error("Error adding ice candidate:", error);
                          });
                      }
                    });
                  },
                  (error) => {
                    console.error("Error getting candidate collection:", error);
                  }
                );
                setPcs((prevPcs) => [...prevPcs, pc]);
                await signalDoc.update({ signal: 3 });
              }
            }
          });
        }
      } else {
        console.log("No such document!");
      }
    });
  };

  const handleAnswerButtonClick = async () => {
    setInCall(true);
    if (hangupButtonRef.current) hangupButtonRef.current.disabled = false;

    let callId;
    const idFromParams = searchParams.get("id");

    if (idFromParams) {
      callId = idFromParams;
      setCallId(idFromParams);
      replace(`${pathname}?id=${idFromParams}`);
    } else if (callInputRef.current) {
      callId = callInputRef.current.value;
      setCallId(callInputRef.current.value);
      replace(`${pathname}?id=${callInputRef.current.value}`);
    }
    const callDocHost = firestore.collection("calls").doc(callId);
    const lengthUsers = (await callDocHost.get()).data()?.connectedUsers;
    let indexOfOtherConnectedCandidates = await callDocHost.collection("otherCandidates").doc(`indexOfConnectedCandidates`);

    const myIndex = lengthUsers + 1;
    setMyIndex(lengthUsers);
    setChatIndex(lengthUsers+1)
    console.log("MY INDEX IS ",myIndex)
    await callDocHost.update({ connectedUsers: myIndex });

    await indexOfOtherConnectedCandidates.update({
      indexOfCurrentUsers: firebase.firestore.FieldValue.arrayUnion(myIndex),
    });

    let pc: RTCPeerConnection;
    console.log("Index of other", indexOfOtherConnectedCandidates.get())

    indexOfOtherConnectedCandidates.onSnapshot(async (doc) => {
      if (doc.exists) {
        //Check for any newly addded users
        if (
          doc.data()?.indexOfCurrentUsers[doc.data()?.indexOfCurrentUsers.length - 1] != myIndex &&
          doc.data()?.indexOfCurrentUsers[doc.data()?.indexOfCurrentUsers.length - 1] &&
          doc.data()?.indexOfCurrentUsers[doc.data()?.indexOfCurrentUsers.length - 1] > myIndex
        ) {
          setAfterCall((prev) => prev + 1);
          console.log("After Call:", afterCall);
          const newAddedUser = doc.data()?.indexOfCurrentUsers[doc.data()?.indexOfCurrentUsers.length - 1];
          let signalDoc = callDocHost.collection("signal").doc(`signal${newAddedUser}${myIndex}`);
          console.log(`${newAddedUser} added`);
          console.log(`${myIndex} myIndex`);
          await signalDoc.set({
            userAdded: `${newAddedUser} added`,
            signal: 0,
          });
          let offerAnswerPairs: firebase.firestore.DocumentReference<firebase.firestore.DocumentData>;
          let offerCandidatesCollection: firebase.firestore.CollectionReference<firebase.firestore.DocumentData>;
          let answerCandidatesCollection: firebase.firestore.CollectionReference<firebase.firestore.DocumentData>;
          let candidateNameDoc: firebase.firestore.DocumentReference<firebase.firestore.DocumentData>;
          signalDoc.onSnapshot(async (doc) => {
            if (doc.exists) {
              const data = doc.data();
              const signal = data?.signal;
              if (signal === 0) {
                pc = new RTCPeerConnection(servers);
                pc = setupPeerConnection(pc);
                candidateNameDoc = callDocHost.collection("otherCandidates").doc(`candidate${newAddedUser}${myIndex}`);
                offerCandidatesCollection = callDocHost.collection("otherCandidates").doc(`candidate${newAddedUser}${myIndex}`).collection("offerCandidates");
                answerCandidatesCollection = callDocHost.collection("otherCandidates").doc(`candidate${newAddedUser}${myIndex}`).collection("answerCandidates");
                candidateNameDoc.set({ myName: "Moderator", joiner: "" });
                pc.onicecandidate = async (event) => {
                  event.candidate && (await offerCandidatesCollection.add(event.candidate.toJSON()));
                };
                offerAnswerPairs = callDocHost.collection("otherCandidates").doc(`offerAnswerPairs${newAddedUser}${myIndex}`);

                pc.onicecandidate = async (event) => {
                  event.candidate && (await offerCandidatesCollection.add(event.candidate.toJSON()));
                };

                const offerDescription = await pc.createOffer();
                await pc.setLocalDescription(offerDescription);

                let offer = {
                  sdp: offerDescription.sdp as string,
                  type: offerDescription.type,
                };

                let offerAnswerPair: OfferAnswerPair = {
                  offer: offer,
                  answer: null,
                };

                const currentPairs: OfferAnswerPair[] = (await offerAnswerPairs.get()).data()?.offerAnswerPairs || [];

                await currentPairs.push(offerAnswerPair);
                console.log(currentPairs);
                await offerAnswerPairs.set({
                  offerAnswerPairs: currentPairs,
                });
                await signalDoc.set({ signal: 1 });
              } else if (signal == 2) {
                const answerDescription = new RTCSessionDescription((await offerAnswerPairs.get()).data()?.offerAnswerPairs[0].answer);
                console.log("Data on receiver is ", (await offerAnswerPairs.get()).data()?.offerAnswerPairs[0].answer);
                await pc.setRemoteDescription(answerDescription);

                await answerCandidatesCollection.onSnapshot(
                  async (snapshot) => {
                    await snapshot.docChanges().forEach(async (change) => {
                      if (change.type === "added") {
                        const candidateData = change.doc.data();
                        const candidate = new RTCIceCandidate(candidateData);
                        await pc
                          .addIceCandidate(candidate)
                          .then(() => {
                            console.log("Ice candidate added successfully");
                          })
                          .catch((error) => {
                            console.error("Error adding ice candidate:", error);
                          });
                      }
                    });
                  },
                  (error) => {
                    console.error("Error getting candidate collection:", error);
                  }
                );
                setPcs((prevPcs) => [...prevPcs, pc]);
                await signalDoc.update({ signal: 3 });
              }
            }
          });
        }
      } else {
        console.log("No such document!");
      }
    });
    const indexUsers = (await indexOfOtherConnectedCandidates.get()).data()?.indexOfCurrentUsers;
    await indexUsers.forEach(async (existingCaller: number) => {
      console.log(`User Index: ${existingCaller}`);
      let signalDoc = callDocHost.collection("signal").doc(`signal${myIndex}${existingCaller}`);
      let offerAnswerPairs: firebase.firestore.DocumentReference<firebase.firestore.DocumentData>;
      let offerCandidatesCollection = callDocHost.collection("otherCandidates").doc(`candidate${myIndex}${existingCaller}`).collection("offerCandidates");
      let candidateNameDoc = callDocHost.collection("otherCandidates").doc(`candidate${myIndex}${existingCaller}`);
      let pc: RTCPeerConnection;

      signalDoc.onSnapshot(async (doc) => {
        if (doc.exists) {
          const data = doc.data();
          const signal = data?.signal;

          if (signal === 1) {
            pc = new RTCPeerConnection(servers);
            pc = setupPeerConnection(pc);
            offerAnswerPairs = callDocHost.collection("otherCandidates").doc(`offerAnswerPairs${myIndex}${existingCaller}`);
            console.log(`pair is ${myIndex}${existingCaller}`);
            candidateNameDoc.update({ joiner: "Moderator" });
            const answerCandidatesCollection = callDocHost
              .collection("otherCandidates")
              .doc(`candidate${myIndex}${existingCaller}`)
              .collection("answerCandidates");
            if (pc)
              pc.onicecandidate = async (event) => {
                event.candidate && (await answerCandidatesCollection.add(event.candidate.toJSON()));
              };

            const offerDescription = new RTCSessionDescription((await offerAnswerPairs.get()).data()?.offerAnswerPairs[0].offer);
            console.log("offer is ", (await offerAnswerPairs.get()).data()?.offerAnswerPairs);
            await pc.setRemoteDescription(offerDescription);

            const answerDescription = await pc.createAnswer();
            await pc.setLocalDescription(answerDescription);

            const answer = {
              sdp: answerDescription.sdp,
              type: answerDescription.type,
            };

            const currentPair = (await offerAnswerPairs.get()).data()?.offerAnswerPairs[0];
            console.log("Current pair is ", currentPair);
            currentPair.answer = answer;

            await offerAnswerPairs.update({
              offerAnswerPairs: [currentPair],
            });

            await signalDoc.update({ signal: 2 });
          } else if (signal === 3) {
            console.log("Before Call:", beforeCall);
            console.log("The remote description after setting it is ", pc);
            await offerCandidatesCollection.get().then(async (snapshot) => {
              await snapshot.docs.forEach(async (doc) => {
                const candidateData = doc.data();
                const candidate = new RTCIceCandidate(candidateData);
                await pc
                  .addIceCandidate(candidate)
                  .then(() => {
                    console.log("Ice candidate added successfully");
                  })
                  .catch((error) => {
                    console.error("Error adding ice candidate:", error);
                  });
              });
            });

            await offerCandidatesCollection.onSnapshot(
              async (snapshot) => {
                await snapshot.docChanges().forEach(async (change) => {
                  if (change.type === "added") {
                    const candidateData = change.doc.data();
                    const candidate = new RTCIceCandidate(candidateData);
                    await pc
                      .addIceCandidate(candidate)
                      .then(() => {
                        console.log("Ice candidate added successfully");
                      })
                      .catch((error) => {
                        console.error("Error adding ice candidate:", error);
                      });
                  }
                });
              },
              (error) => {
                console.error("Error listening for offerCandidates changes:", error);
              }
            );
            setPcs((prevPcs) => [...prevPcs, pc]);
            await signalDoc.update({ signal: 4 });
          }
        }
      });
    });

    if (answerButtonRef.current) answerButtonRef.current.disabled = true;
  };

  const sendMessage = () => {
    if (!messageText.trim()) return;

    const message: Message = {
      text: messageText,
      sender: chatIndex || 0,
      timestamp: new Date(),
    };

    // Send message through all open data channels
    dataChannels.forEach(channel => {
      if (channel.readyState === "open") {
        try {
          channel.send(JSON.stringify(message));
        } catch (error) {
          console.error("Error sending message:", error);
        }
      }
    });

    // Add own message to messages
    setMessages(prev => [...prev, message]);
    setMessageText("");
  };

  useEffect(() => {
    if (callButtonRef.current) {
      callButtonRef.current.onclick = handleCallButtonClick;
    }
    if (answerButtonRef.current) {
      answerButtonRef.current.onclick = handleAnswerButtonClick;
    }
  }, []);

  const hangup = async () => {
    // Close all data channels
    dataChannels.forEach(channel => {
      channel.close();
    });
    setDataChannels([]);

    // ... (rest of your existing hangup code)
    console.log("The current pcs are: ", pcs);
    console.log(myIndex);
    const callDoc = firestore.collection("calls").doc(callId);
    let hangupDoc = callDoc.collection("hangup").doc(`hangups`);
    await hangupDoc.set({ hangup: myIndex });

    pcs.forEach((pc) => {
      pc.close();
    });
    setPcs([]);
  };
  

  useEffect(() => {
    const callDoc = firestore.collection("calls").doc(callId);
    let hangupCollection = callDoc.collection("hangup");
  }, [callId, myIndex]);

  const handleIceConnectionStateChange = useCallback(
    (pc: RTCPeerConnection, index: number) => {
      if (pc.connectionState === "disconnected") {
        console.log(`PC at index ${index} has connectionState as disconnected`);

        setCallLeft((prev) => prev + 1);

        if (index <= beforeCall) {
          setBeforeCall((prev) => {
            const updatedBeforeCall = prev - 1;
            console.log("Updated beforeCall:", updatedBeforeCall);
            return updatedBeforeCall;
          });
        } else {
          setAfterCall((prev) => prev - 1);
        }

        console.log("Caller left, new callLeft:", callLeft + 1);
      }
    },
    [beforeCall, callLeft]
  );

  useEffect(() => {
    const listeners = new Map();

    pcs.forEach((pc, index) => {
      const listener = (event: Event) => {
        handleIceConnectionStateChange(event.currentTarget as RTCPeerConnection, index);
      };
      listeners.set(pc, listener);
      pc.addEventListener("connectionstatechange", listener);
    });

    return () => {
      listeners.forEach((listener, pc) => {
        pc.removeEventListener("connectionstatechange", listener);
      });
    };
  }, [pcs, handleIceConnectionStateChange]);

  const hasEffectRun = useRef(false);

  useEffect(() => {
    const initCall = async () => {
      if (!hasEffectRun.current) {
        hasEffectRun.current = true;

        const id = searchParams.get("id");
        if (id) {
          setCallId(id);
          if (callInputRef.current) {
           callInputRef.current.value = id;
          }
          handleAnswerButtonClick();
        } else {
          handleCallButtonClick();
          console.log("Initiated")
        }
        setIsClient(true); // Indicate that the client is set up
      }
    };

    initCall(); // Run the initialization
  }, []);



  const copyLink = () => {
    const currentUrl = new URL(window.location.href);
    if (currentUrl.pathname === "/transcript") {
      currentUrl.pathname = "/meet";
    }

    navigator.clipboard
      .writeText(currentUrl.toString())
      .then(() => {
        toast.success("Link copied");
      })
      .catch((error) => {
        console.error("Failed to copy link: ", error);
      });
  };



  useEffect(() => {
    console.log("PCs are ", pcs);
    console.log("Names are ", nameList);
  }, [pcs, nameList]);

  return (
    <div className="mx-auto p-5 w-full">
    <h2 className="text-2xl font-semibold my-4">Web-RTC</h2>
    
    {/* Keep your existing UI elements */}
    
    {/* Add messaging UI */}
    {inCall && (
      <div className="mt-8">
        {chatIndex}
        <div className="border rounded-lg p-4 h-64 overflow-y-auto mb-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`mb-2 ${message.sender === chatIndex ? 'text-right' : 'text-left'}`}
            >
              <span className={`inline-block rounded-lg px-3 py-2 bg-blue-500 text-white`}>
                <span className="text-sm opacity-75">User {message.sender}</span>
                <p>{message.text}</p>
                <span className="text-xs opacity-75">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </span>
              </span>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Type your message..."
            className="flex-1 border rounded-lg px-3 py-2"
          />
          <button
            onClick={sendMessage}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
          >
            Send
          </button>
        </div>
      </div>
    )}
  </div>
  );
};

export default Page;
