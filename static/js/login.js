const ui = new firebaseui.auth.AuthUI(firebase.auth());
const uiConfig = {
  credentialHelper: firebaseui.auth.CredentialHelper.NONE,
  accountChooserEnabled: false,
  signInSuccessUrl: 'index.html',
  signInOptions: [{
    provider: firebase.auth.EmailAuthProvider.PROVIDER_ID,
    requireDisplayName: false
  }]
};

ui.start('#firebaseui-auth-container', uiConfig);
