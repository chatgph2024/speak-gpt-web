import React, {useEffect} from 'react';
import {MaterialButtonTonal} from "../widgets/MaterialButton";
import Message from "./Message";
import OpenAI from "openai";
import {sha256} from "js-sha256";

function CurrentChat({chats, id, chatName}) {
    const [conversation, setConversation] = React.useState([]);
    const [lockedState, setLockedState] = React.useState(false);
    const [stateSelectedChat, setStateSelectedChat] = React.useState(chatName);
    const [db, setDb] = React.useState(null);

    useEffect(() => {
        getDatabase()
    }, []);

    useEffect(() => {
        chats.forEach((e) => {
            if (sha256(e.title) === id) {
                setStateSelectedChat(e.title);
            }
        });

        if (id === undefined) {
            setStateSelectedChat("");
        }
    }, [id, chatName]);

    useEffect(() => {
        if (stateSelectedChat === "") {
            setConversation([]);
            return;
        }

        if (db !== undefined && db !== null) {
            getConversation(sha256(stateSelectedChat));
        }

        // setConversation(localStorage.getItem(sha256(stateSelectedChat)) !== null ? JSON.parse(localStorage.getItem(sha256(stateSelectedChat))) : []);
    }, [db, stateSelectedChat]);

    const prepareConversation = (messages) => {
        const msgs = [];

        messages.forEach((e) => {
            if (!e.message.toString().includes("~file:")) {
                msgs.push({
                    content: e.message,
                    role: e.isBot ? "assistant" : "user"
                });
            }
        });

        return msgs;
    }

    const sendAIRequest = async (messages) => {
        const openai = new OpenAI({
            apiKey: localStorage.getItem("apiKey"),
            dangerouslyAllowBrowser: true
        });

        const chatCompletion = await openai.chat.completions.create({
            messages: messages,
            model: "gpt-4-turbo-preview",
            stream: true,
        });

        const m = conversation;

        m.push({
            message: "",
            isBot: true
        });

        setConversation([...m]);
        saveConversation(sha256(stateSelectedChat), JSON.stringify(m))

        for await (const chunk of chatCompletion) {
            const r = chunk.choices[0].delta;

            const m = conversation;

            if (chunk.choices[0] !== undefined && chunk.choices[0].delta !== undefined && r !== undefined && chunk.choices[0].delta.content !== undefined) {
                m[m.length - 1].message += r.content;

                setConversation([...m]);
                saveConversation(sha256(stateSelectedChat), JSON.stringify(m))
                document.getElementById("bottom").scrollIntoView();
            }
        }

        return "";
    }

    const getDatabase = () => {
        let db;

        const request = indexedDB.open("chats", 1);

        request.onupgradeneeded = function(event) {
            // Save the IDBDatabase interface
            db = event.target.result;

            // Create an objectStore for this database
            if (!db.objectStoreNames.contains('chats')) {
                db.createObjectStore('chats', { keyPath: 'chatId'});
            }
        };

        request.onsuccess = function(event) {
            db = event.target.result;
            setDb(db)
            console.log("Database opened successfully");
        };

        request.onerror = function(event) {
            console.log("Error opening database", event.target.errorCode);
        };
    }

    const getConversation = (chatId) => {
        const transaction = db.transaction(['chats'], 'readonly');
        const objectStore = transaction.objectStore('chats');
        const request = objectStore.getAll();

        request.onsuccess = function() {
            let isFound = false;

            request.result.forEach((e) => {
                if (e.chatId === chatId) {
                    isFound = true;
                    setConversation(JSON.parse(e.content));
                }
            });

            if (!isFound) {
                setConversation([]);
            }
        };

        request.onerror = function(event) {
            console.log("Error getting conversation", event.target.errorCode);
        }
    }

    const saveConversation = (chatId, conversation) => {
        const transaction = db.transaction(['chats'], 'readwrite');
        const objectStore = transaction.objectStore('chats');
        const request = objectStore.put({ chatId: chatId, content: conversation });

        request.onsuccess = function() {
            console.log("Conversation saved successfully");
        };

        request.onerror = function(event) {
            console.log("Error saving conversation", event);
        }
    }

    const processRequest = () => {
        if (lockedState) {
            return;
        }

        const messages = conversation;

        setLockedState(true);
        messages.push({
            message: document.querySelector(".chat-textarea").value,
            isBot: false
        });

        document.querySelector(".chat-textarea").value = "";

        setConversation([...messages]);
        saveConversation(sha256(stateSelectedChat), JSON.stringify(messages));

        sendAIRequest(prepareConversation(messages)).then(r => {
            setLockedState(false);
        });
    }

    return (
        <div className={"chat-frame"}>
            <div className={"chat-area"}>
                <div className={"chat-history"}>
                    <h3 className={"chat-title"}>{stateSelectedChat}</h3>
                    <div>
                        {
                            conversation.map((e, i) => {
                                return (
                                    <Message key={i} isBot={e.isBot} message={e.message}/>
                                )
                            })
                        }
                    </div>
                    <div id={"bottom"}></div>
                </div>
                <div className={"write-bar"}>
                    <textarea className={"chat-textarea"} placeholder={"Start typing here..."}/>
                    <div>
                        <MaterialButtonTonal className={"chat-send"} onClick={() => {
                            processRequest();
                        }}><span
                            className={"material-symbols-outlined"}>send</span></MaterialButtonTonal>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default CurrentChat;