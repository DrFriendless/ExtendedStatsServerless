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
    const geek = localStorage.getItem("username");
    if (geek) username = geek;
}

function showAndHide() {
    if (username) {
        if (document.getElementById("btn-login")) document.getElementById("btn-login").style.display = "none";
        if (document.getElementById("extstats-logout")) document.getElementById("extstats-logout").style.display = "block";
    } else {
        if (document.getElementById("btn-login")) document.getElementById("btn-login").style.display = "block";
        if (document.getElementById("extstats-logout")) document.getElementById("extstats-logout").style.display = "none";
    }
    if (document.getElementById("user-link")) document.getElementById("user-link").innerHTML = username;
}

lock.on("authenticated", authResult => {
    console.log("authenticated");
    console.log(authResult);
    localStorage.setItem('accessToken', authResult.accessToken);
    localStorage.setItem('identity', JSON.stringify(authResult.idTokenPayload));
    loadUserData(authResult.idToken);
});

window.addEventListener("load", () => {
    setUserFromLocalStorage();
    showAndHide();
});
