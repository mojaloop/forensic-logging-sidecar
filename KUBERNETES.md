# Running central-kms on Kubernetes

1. Install VirtualBox
    Refer to: https://www.virtualbox.org/wiki/Downloads

2. Install Docker
    MacOS: `brew install docker`

3. Install Kubectl
    MacOS: `brew install kubectl`

4. Install Minikube
    MacOS: `brew cask install minikube`

5. Install Helm
    MacOS: `brew install kubernetes-helm`

6. Initialise MiniKube
    `minikube start`

7. Initialise Helm
    `helm init` <-- this only needs to be done once

8. Deploy Ingress
    `minikube addon ingress enable`

9. Configure PostgreSQL
    Edit `postgresUser` & `postgresPassword` as desired in the follow file `./k8s/forensic-logging-sidecar-helm-postgresql-values.yaml` 

10. Deploy PosgreSQL
    `helm install --name forensic-logging-sidecar -f ./k8s/central-kms-helm-postgresql-values.yaml stable/postgresql`

11. Configure credentials in the forensic-logging-sidecar
    Edit `db.uri` with the details from step 10 above in the following file `./k8s/forensic-logging-sidecar-secret.yaml`. 
    
    Ensure the values are base64 encoded.

12. Deploy Central-kms
    `kubectl create -f ./k8s`

    Or alternatively you can stipulate a namespace for deployment
    `kubectl -n dev create -f ./k8s`

13. Add the following to your hosts file
`<IP>	central-kms.local`

Where `<IP>` can be attained using the following command `minikube ip`

14. Open K8s Dashboard

`minikube dashboard`
