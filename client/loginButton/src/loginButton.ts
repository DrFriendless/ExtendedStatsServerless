declare var Auth0Lock: any;

const authOptions = {
    auth: {
        responseType: 'token id_token',
        scope: 'openid',
        redirect: false
    },
    autoclose: true,
    oidcConformant: true,
    popupOptions: { width: 300, height: 400 },
    usernameStyle: 'username'
};

let username;

const lock = new Auth0Lock(
    'z7FL2jZnXI9C66WcmCMC7V1STnQbFuQl',
    'drfriendless.au.auth0.com',
    authOptions
);
export function login() {
    lock.show();
}
export function logout() {
    localStorage.removeItem("username");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("identity");
    localStorage.removeItem("jwt");
    username = undefined;
    showAndHide();
}
function loadUserData(jwt: string) {
    const xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            const response = JSON.parse(xhttp.responseText);
            console.log(response);
            username = response.username;
            localStorage.setItem("username", response.username);
            showAndHide();
        }
    };
    xhttp.open("GET", "https://api.drfriendless.com/v1/authenticate", true);
    xhttp.setRequestHeader("Authorization", "Bearer " + jwt);
    xhttp.send();
}

function setUserFromLocalStorage() {
    const identity = localStorage.getItem("identity");
    if (identity) {
        console.log("Found identity in local storage");
        const id = JSON.parse(identity);
        console.log(id);
        const seconds = (new Date()).getTime() / 1000;
        if (id.exp < seconds) {
            console.log("Login expired");
            localStorage.removeItem("accessToken");
            localStorage.removeItem("identity");
            localStorage.removeItem("jwt");
            localStorage.removeItem("username");
            return;
        }
        localStorage.setItem("username", id["nickname"]);
    } else {
        console.log("No identity in local storage.");
    }
    const user = localStorage.getItem("username");
    if (user) {
        console.log("setting username to " + user);
        username = user;
    }
}

function showAndHide() {
    console.log("showAndHide");
    if (username) {
        if (document.getElementById("btn-login")) document.getElementById("btn-login").style.display = "none";
        if (document.getElementById("extstats-logout")) {
            document.getElementById("extstats-logout").style.display = "block";
            document.getElementById("btn-logout").style.display = "block";
        }
    } else {
        if (document.getElementById("btn-login")) document.getElementById("btn-login").style.display = "block";
        if (document.getElementById("extstats-logout")) document.getElementById("extstats-logout").style.display = "none";
    }
    if (document.getElementById("user-link")) {
        if (username) {
            document.getElementById("user-link").innerHTML = username;
        } else {
            document.getElementById("user-link").innerHTML = "";
        }
    }
}

lock.on("authenticated", authResult => {
    console.log("authenticated");
    console.log(authResult);
    localStorage.setItem('accessToken', authResult.accessToken);
    localStorage.setItem('identity', JSON.stringify(authResult.idTokenPayload));
    localStorage.setItem("jwt", authResult.idToken);
    loadUserData(authResult.idToken);
});

window.addEventListener("load", () => {
    setUserFromLocalStorage();
    showAndHide();
});
