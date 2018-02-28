# Forensic Logging Sidecar and KMS Review

Tasks performed:
The Forensic Logging Sidecar (FLS) was run locally as well as using Kubernetes setup as described in the [K8s development guide](https://github.com/mojaloop/mojaloop/blob/develop/contribute/Local-K8s-Development-Guide.md). Another scenario as described in the K8s guide was also done where the FLS service was run locally whereas the rest of the dependencies (postgresql and KMS) were running in the K8s cluster (minikube, and were exposed for the locally running services). As as extension to this, central ledger was also run locally on the host machine and was connected to the FLS service that was running locally. Observations were made as Postman was used to make several calls to the Central Ledger service.

### Observations:
1. One common task for both the KMS and FLS services is to create a system surrounding these to restrict the services that can discover and connect to them. As of right now, any service that knows the host and port details (and the API Spec, which is Open Source) of these services can connect to them without any further requirement. This initial Registration mechanism needs to be addressed. Possibly, there should be limits as well on how many sidecars can be connected to a KMS service, as well as services connecting to a single sidecar.
2. For Central KMS service (on socket), for the inquiry request there is no timestamp involved, either when the request is raised or before when the request is expected to be responded to, by the sidecar.
3. The GET /sidecars endpoint on the API section of Central KMS needs to be secured as well (similar to #1 above) as currently it is open and would reveal the details of all the sidecars that are registered. If not, the details can be obtained of all the sidecars that are registered and these can be used to make other requests in the API, to gather more information/data.
4. For the sidecar, a decision needs to be made (perhaps based on scheme/business rules) regarding what type of logs are sent by a client FLS service to the FLS and thereby to the KMS.
5. The FLS needs to be tested for scenarios involving spoofing, MITM, resuming after disconnecting and similar cases that affect security.
6. The [documentation of the Central KMS service](https://github.com/mojaloop/central-kms/blob/master/Socket.md) needs some fixes. A couple of spelling errors need to be fixed. Here are couple more minor issues:
6.1 The description for [Save Batch](https://github.com/mojaloop/central-kms/blob/master/Socket.md#save-batch) is same as 'challenge response' section.
6.2 Description for Section rowKey is missing under the [Response Params section](https://github.com/mojaloop/central-kms/blob/develop/Socket.md#register)
