/** Main object to store dom element refrences */
let dom = {};

/** Object to store main http request promise (only one request at a time) */
let mainPromise = null;

/** Function to initialize and fill said dom object */
function initDom() {
  dom = {
    userInput: document.getElementById("input-username"),
    username: document.getElementById("username"),
    fullname: document.getElementById("fullname"),
    tags: document.getElementById("tags"),
    bio: document.getElementById("bio"),
    bioComponent: document.getElementById("bio-component"),
    avatar: document.getElementById("avatar"),
    user: document.getElementById("user-component"),
    form: document.getElementById("main-form"),
    submit: document.getElementById("submit"),
    error: document.getElementById("error"),
  };
}

/** Function to initialize error handling for error element (and its class list) */
function initError() {
  const err = dom.error;
  err.addEventListener("transitionend", e => {
    if (err.classList.contains("hiding")) {
      err.classList.add("hidden");
      err.classList.remove("hiding");
    }
  });
}

/** Function to call when ever we need to show an error to the user (animations also handled).
 *
 * Error message will be disappeared after 5 seconds.
 */
function error(msg = "Error") {
  console.log(msg);
  const err = dom.error;
  if (err.timeout) clearTimeout(err.timeout);
  err.timeout = setTimeout(() => {
    err.classList.add("hiding");
    err.timeout = null;
  }, 5000);
  err.innerHTML = String(msg);
  err.classList.remove("hiding");
  err.classList.remove("hidden");
}

/** new error class to indicate the error was a network error or a logical error that we know of */
class KnownError extends Error {
  constructor(msg, isNetworkError) {
    super(msg);
    this.isNetworkError = isNetworkError;
  }
}

/**
 * The main function that handles user submits.
 *
 * It checks for local storage to read data from manually cached data if possible.
 *
 * Calls start and stop loading functions when needed.
 *
 * Uses the error function to show network related or invalid username errors.
 *
 * Doesn't do anything if the submit button status is not "ready".
 *
 * Caches fetched data into local storage to prevent hitting rate limit on github api.
 *
 * Calls render function to show data to the user.
 */
async function getUser() {
  if (dom.submit.getAttribute("status") !== "ready") return;
  if (mainPromise !== null) return;
  const { value, isValid } = getValue();
  if (!isValid) return error("Github username is not valid.");
  const cache = localStorage.getItem("user:" + value);
  if (cache) {
    const data = JSON.parse(cache);
    if (data.notFound) return error("Username not found");
    return renderUserData(data);
  }
  handleStartLoading();
  mainPromise = fetch(`https://api.github.com/users/${value}`)
    .then(res => {
      if (400 <= res.status && res.status < 600)
        throw (
          (res.status === 403 && new KnownError("Github API rate limit reached.", false)) ||
          (res.status === 404 && new KnownError("Username not found", false)) ||
          new KnownError(res.statusText, true)
        );
      return res;
    })
    .then(res => res.json())
    .catch(err => {
      error(err instanceof KnownError && !err.isNetworkError ? err.message : `Network Error: ${err.message}`);
    })
    .finally(() => {
      mainPromise = null;
      handleFinishLoading();
    });
  let result = await mainPromise;
  if (!result) result = { notFound: true };
  localStorage.setItem("user:" + value, JSON.stringify(result));
  renderUserData(result);
}

/** An object to use when extracting tags from data
 *
 * Keys inside this object will be checked in the given data
 * be filtered properly. Also proper namings and icon styles are available in the object.
 */
const tagKeys = {
  company: {
    icon: "fa-solid fa-building",
    keyText: "Company",
  },
  blog: {
    icon: "fa-solid fa-pen",
    keyText: "Blog",
  },
  location: {
    icon: "fa-solid fa-location-dot",
    keyText: "Location",
  },
  email: {
    icon: "fa-solid fa-envelope",
    keyText: "Email",
  },
  followers: {
    icon: "fa-solid fa-user-group",
    keyText: "Followers",
  },
  following: {
    icon: "fa-solid fa-user-group",
    keyText: "Following",
  },
};

/**
 * This function gets a data object in the structure that github api returns.
 *
 * It sets up dom elements to start showing proper data to the user.
 * Makes main column visible. Translates '\r\n' into <br/> for proper line display.
 * filters tags and creates tag dom components.
 * Optional display for different parts is supported.
 */
function renderUserData(data) {
  if (data.notFound) return;
  dom.user.style.display = "initial";
  dom.username.innerHTML = data.login;
  dom.username.href = data.html_url;
  dom.fullname.style.display = data.name ? "block" : "none";
  dom.fullname.innerHTML = data.name;
  dom.bioComponent.style.display = data.bio ? "block" : "none";
  dom.bio.innerHTML = String(data.bio).replace(/\r\n/g, "<br/>");
  dom.avatar.src = data.avatar_url;
  dom.tags.replaceChildren();
  Object.entries(tagKeys).forEach(([k, v]) => {
    if (!data[k]) return;
    const mainElem = document.createElement("div");
    mainElem.classList.add("tag");
    const iconElem = document.createElement("i");
    iconElem.classList.add("tag__icon");
    v.icon.split(" ").forEach(cls => iconElem.classList.add(cls));
    const keyElem = document.createElement("span");
    keyElem.classList.add("tag__key");
    keyElem.innerHTML = v.keyText;
    const textElem = document.createElement("span");
    textElem.classList.add("tag__content");
    textElem.innerHTML = data[k];
    mainElem.appendChild(iconElem);
    mainElem.appendChild(keyElem);
    mainElem.appendChild(textElem);
    dom.tags.appendChild(mainElem);
  });
}

/** Reads the value of form input and evaluates validness of the value. */
function getValue() {
  const value = dom.userInput?.value?.toLocaleLowerCase();
  if (!value) return { value: "", isValid: false };
  const isValid = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i.test(value);
  return { value, isValid };
}

/** This function checks the validness of input and updates status of the submit button accordingly. */
async function updateStatus() {
  if (dom.submit.getAttribute("status") === "loading") return;
  const { value, isValid } = getValue();
  dom.submit.setAttribute("status", isValid ? "ready" : "disabled");
  dom.submit[isValid ? "removeAttribute" : "setAttribute"]("disabled", true);
}

/** Handles starting the loading process for dom elements */
async function handleStartLoading() {
  dom.submit.setAttribute("status", "loading");
}

/** Handles stopping the loading process for dom elements */
async function handleFinishLoading() {
  dom.submit.setAttribute("status", "disabled");
  updateStatus();
}

/** The main function to start when DOM is ready */
function main() {
  initDom();
  initError();
  dom.userInput.addEventListener("input", updateStatus);
  dom.form.addEventListener("submit", e => {
    e.preventDefault();
    getUser();
  });
  updateStatus();
}

/** When DOM content is loaded, runs the main function */
document.addEventListener("DOMContentLoaded", main);
