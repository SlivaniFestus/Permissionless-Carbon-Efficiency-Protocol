verification-oracle.clar
(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-STAKE-AMOUNT u101)
(define-constant ERR-INVALID-PROOF u102)
(define-constant ERR-INVALID-NONCE u103)
(define-constant ERR-INVALID-THRESHOLD u104)
(define-constant ERR-ORACLE-ALREADY-EXISTS u105)
(define-constant ERR-ORACLE-NOT-FOUND u106)
(define-constant ERR-INVALID-TIMESTAMP u107)
(define-constant ERR-AUTHORITY-NOT-VERIFIED u108)
(define-constant ERR-INVALID-DISPUTE-FEE u109)
(define-constant ERR-INVALID-SLASH-RATE u110)
(define-constant ERR-INVALID-LOCATION u111)
(define-constant ERR-INVALID-CURRENCY u112)
(define-constant ERR-INVALID-STATUS u113)
(define-constant ERR-MAX-ORACLES-EXCEEDED u114)
(define-constant ERR-INVALID-ORACLE-TYPE u115)
(define-constant ERR-INVALID-REWARD-RATE u116)
(define-constant ERR-INVALID-GRACE-PERIOD u117)
(define-constant ERR-DISPUTE-ALREADY-EXISTS u118)
(define-constant ERR-DISPUTE-NOT-FOUND u119)
(define-constant ERR-INVALID-VOTE u120)
(define-constant ERR-VOTING_CLOSED u121)
(define-constant ERR-INSUFFICIENT-STAKE u122)
(define-constant ERR-PROOF_EXPIRED u123)
(define-constant ERR-INVALID_CONSENSUS u124)
(define-constant ERR-INVALID_UPDATE_PARAM u125)

(define-data-var next-oracle-id uint u0)
(define-data-var max-oracles uint u500)
(define-data-var staking-requirement uint u10000)
(define-data-var dispute-fee uint u500)
(define-data-var slash-rate uint u10)
(define-data-var consensus-threshold uint u51)
(define-data-var reward-rate uint u5)
(define-data-var authority-contract (optional principal) none)

(define-map oracles
  uint
  {
    owner: principal,
    stake: uint,
    oracle-type: (string-utf8 50),
    location: (string-utf8 100),
    currency: (string-utf8 20),
    status: bool,
    timestamp: uint,
    reward-balance: uint
  }
)

(define-map oracles-by-owner
  principal
  uint)

(define-map proofs
  {data-hash: (buff 32), nonce: uint}
  {proof: (buff 32), submitter: principal, timestamp: uint, votes: uint, consensus-reached: bool}
)

(define-map disputes
  {proof-hash: (buff 32)}
  {disputer: principal, fee-paid: uint, votes-for: uint, votes-against: uint, resolved: bool, timestamp: uint}
)

(define-map oracle-nonces principal uint)

(define-read-only (get-oracle (id uint))
  (map-get? oracles id)
)

(define-read-only (get-proof (data-hash (buff 32)) (nonce uint))
  (map-get? proofs {data-hash: data-hash, nonce: nonce})
)

(define-read-only (get-dispute (proof-hash (buff 32)))
  (map-get? disputes {proof-hash: proof-hash})
)

(define-read-only (is-oracle-registered (owner principal))
  (is-some (map-get? oracles-by-owner owner))
)

(define-private (validate-stake (stake uint))
  (if (>= stake (var-get staking-requirement))
      (ok true)
      (err ERR-INSUFFICIENT-STAKE))
)

(define-private (validate-proof-buff (proof (buff 32)))
  (if (is-eq (len proof) u32)
      (ok true)
      (err ERR-INVALID-PROOF))
)

(define-private (validate-nonce (nonce uint))
  (if (> nonce u0)
      (ok true)
      (err ERR-INVALID-NONCE))
)

(define-private (validate-threshold (threshold uint))
  (if (and (> threshold u0) (<= threshold u100))
      (ok true)
      (err ERR-INVALID-THRESHOLD))
)

(define-private (validate-oracle-type (type (string-utf8 50)))
  (if (or (is-eq type "iot") (is-eq type "satellite") (is-eq type "manual"))
      (ok true)
      (err ERR-INVALID-ORACLE-TYPE))
)

(define-private (validate-location (loc (string-utf8 100)))
  (if (and (> (len loc) u0) (<= (len loc) u100))
      (ok true)
      (err ERR-INVALID_LOCATION))
)

(define-private (validate-currency (cur (string-utf8 20)))
  (if (or (is-eq cur "STX") (is-eq cur "USD") (is-eq cur "BTC"))
      (ok true)
      (err ERR-INVALID_CURRENCY))
)

(define-private (validate-timestamp (ts uint))
  (if (>= ts block-height)
      (ok true)
      (err ERR-INVALID_TIMESTAMP))
)

(define-private (validate-slash-rate (rate uint))
  (if (<= rate u50)
      (ok true)
      (err ERR-INVALID_SLASH-RATE))
)

(define-private (validate-reward-rate (rate uint))
  (if (<= rate u20)
      (ok true)
      (err ERR-INVALID_REWARD-RATE))
)

(define-private (validate-grace-period (period uint))
  (if (<= period u30)
      (ok true)
      (err ERR-INVALID_GRACE-PERIOD))
)

(define-private (validate-dispute-fee (fee uint))
  (if (> fee u0)
      (ok true)
      (err ERR-INVALID_DISPUTE_FEE))
)

(define-private (validate-principal (p principal))
  (if (not (is-eq p 'SP000000000000000000002Q6VF78))
      (ok true)
      (err ERR-NOT-AUTHORIZED))
)

(define-public (set-authority-contract (contract-principal principal))
  (begin
    (try! (validate-principal contract-principal))
    (asserts! (is-none (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set authority-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-staking-requirement (new-stake uint))
  (begin
    (asserts! (> new-stake u0) (err ERR-INVALID_STAKE-AMOUNT))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set staking-requirement new-stake)
    (ok true)
  )
)

(define-public (set-dispute-fee (new-fee uint))
  (begin
    (try! (validate-dispute-fee new-fee))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set dispute-fee new-fee)
    (ok true)
  )
)

(define-public (set-slash-rate (new-rate uint))
  (begin
    (try! (validate-slash-rate new-rate))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set slash-rate new-rate)
    (ok true)
  )
)

(define-public (set-consensus-threshold (new-threshold uint))
  (begin
    (try! (validate-threshold new-threshold))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set consensus-threshold new-threshold)
    (ok true)
  )
)

(define-public (set-reward-rate (new-rate uint))
  (begin
    (try! (validate-reward-rate new-rate))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set reward-rate new-rate)
    (ok true)
  )
)

(define-public (set-max-oracles (new-max uint))
  (begin
    (asserts! (> new-max u0) (err ERR-INVALID_UPDATE_PARAM))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set max-oracles new-max)
    (ok true)
  )
)

(define-public (register-oracle
  (oracle-type (string-utf8 50))
  (location (string-utf8 100))
  (currency (string-utf8 20))
  )
  (let (
        (next-id (var-get next-oracle-id))
        (current-max (var-get max-oracles))
        (authority (var-get authority-contract))
        (stake-amount (var-get staking-requirement))
      )
    (asserts! (< next-id current-max) (err ERR-MAX-ORACLES-EXCEEDED))
    (try! (validate-oracle-type oracle-type))
    (try! (validate-location location))
    (try! (validate-currency currency))
    (asserts! (is-none (map-get? oracles-by-owner tx-sender)) (err ERR-ORACLE-ALREADY-EXISTS))
    (let ((authority-recipient (unwrap! authority (err ERR-AUTHORITY-NOT-VERIFIED))))
      (try! (stx-transfer? stake-amount tx-sender authority-recipient))
    )
    (map-set oracles next-id
      {
        owner: tx-sender,
        stake: stake-amount,
        oracle-type: oracle-type,
        location: location,
        currency: currency,
        status: true,
        timestamp: block-height,
        reward-balance: u0
      }
    )
    (map-set oracles-by-owner tx-sender next-id)
    (var-set next-oracle-id (+ next-id u1))
    (print { event: "oracle-registered", id: next-id })
    (ok next-id)
  )
)

(define-public (submit-proof
  (data-hash (buff 32))
  (proof (buff 32))
  (nonce uint)
  )
  (let (
        (oracle-id (map-get? oracles-by-owner tx-sender))
        (current-nonce (default-to u0 (map-get? oracle-nonces tx-sender)))
      )
    (asserts! (is-some oracle-id) (err ERR-ORACLE-NOT-FOUND))
    (try! (validate-proof-buff proof))
    (try! (validate-nonce nonce))
    (asserts! (is-eq nonce (+ current-nonce u1)) (err ERR-INVALID_NONCE))
    (map-set proofs {data-hash: data-hash, nonce: nonce}
      {
        proof: proof,
        submitter: tx-sender,
        timestamp: block-height,
        votes: u1,
        consensus-reached: false
      }
    )
    (map-set oracle-nonces tx-sender nonce)
    (print { event: "proof-submitted", data-hash: data-hash, nonce: nonce })
    (ok true)
  )
)

(define-public (vote-on-proof
  (data-hash (buff 32))
  (nonce uint)
  (agree bool)
  )
  (let (
        (proof-entry (map-get? proofs {data-hash: data-hash, nonce: nonce}))
        (oracle-id (map-get? oracles-by-owner tx-sender))
      )
    (match proof-entry
      p
        (begin
          (asserts! (is-some oracle-id) (err ERR-ORACLE-NOT-FOUND))
          (asserts! (not (get consensus-reached p)) (err ERR-VOTING_CLOSED))
          (let (
                (new-votes (if agree (+ (get votes p) u1) (get votes p)))
              )
            (if (>= new-votes (var-get consensus-threshold))
              (map-set proofs {data-hash: data-hash, nonce: nonce}
                (merge p {votes: new-votes, consensus-reached: true})
              )
              (map-set proofs {data-hash: data-hash, nonce: nonce}
                (merge p {votes: new-votes})
              )
            )
            (print { event: "vote-cast", data-hash: data-hash, nonce: nonce, agree: agree })
            (ok true)
          )
        )
      (err ERR-PROOF_EXPIRED)
    )
  )
)

(define-public (initiate-dispute
  (proof-hash (buff 32))
  )
  (let (
        (fee (var-get dispute-fee))
        (authority (var-get authority-contract))
      )
    (asserts! (is-none (map-get? disputes {proof-hash: proof-hash})) (err ERR_DISPUTE_ALREADY-EXISTS))
    (let ((authority-recipient (unwrap! authority (err ERR-AUTHORITY-NOT-VERIFIED))))
      (try! (stx-transfer? fee tx-sender authority-recipient))
    )
    (map-set disputes {proof-hash: proof-hash}
      {
        disputer: tx-sender,
        fee-paid: fee,
        votes-for: u0,
        votes-against: u0,
        resolved: false,
        timestamp: block-height
      }
    )
    (print { event: "dispute-initiated", proof-hash: proof-hash })
    (ok true)
  )
)

(define-public (vote-on-dispute
  (proof-hash (buff 32))
  (vote-for bool)
  )
  (let (
        (dispute-entry (map-get? disputes {proof-hash: proof-hash}))
        (oracle-id (map-get? oracles-by-owner tx-sender))
      )
    (match dispute-entry
      d
        (begin
          (asserts! (is-some oracle-id) (err ERR-ORACLE-NOT-FOUND))
          (asserts! (not (get resolved d)) (err ERR_VOTING_CLOSED))
          (let (
                (new-for (if vote-for (+ (get votes-for d) u1) (get votes-for d)))
                (new-against (if (not vote-for) (+ (get votes-against d) u1) (get votes-against d)))
              )
            (if (>= (+ new-for new-against) (var-get consensus-threshold))
              (begin
                (map-set disputes {proof-hash: proof-hash}
                  (merge d {votes-for: new-for, votes-against: new-against, resolved: true})
                )
                (if (> new-for new-against)
                  (try! (slash-oracle proof-hash))
                  (ok true)
                )
              )
              (map-set disputes {proof-hash: proof-hash}
                (merge d {votes-for: new-for, votes-against: new-against})
              )
            )
            (print { event: "dispute-vote", proof-hash: proof-hash, vote-for: vote-for })
            (ok true)
          )
        )
      (err ERR_DISPUTE_NOT_FOUND)
    )
  )
)

(define-private (slash-oracle (proof-hash (buff 32)))
  (let (
        (proof (map-get? proofs {data-hash: proof-hash, nonce: u0}))
      )
    (match proof
      p
        (let (
              (submitter (get submitter p))
              (oracle (map-get? oracles-by-owner submitter))
            )
          (match oracle
            o-id
              (let (
                    (oracle-data (unwrap! (map-get? oracles o-id) (err ERR-ORACLE-NOT-FOUND)))
                    (slash-amount (/ (* (get stake oracle-data) (var-get slash-rate)) u100))
                  )
                (map-set oracles o-id
                  (merge oracle-data {stake: (- (get stake oracle-data) slash-amount)})
                )
                (print { event: "oracle-slashed", id: o-id, amount: slash-amount })
                (ok true)
              )
            (err ERR-ORACLE-NOT-FOUND)
          )
        )
      (err ERR_PROOF_EXPIRED)
    )
  )
)

(define-public (claim-reward (oracle-id uint))
  (let (
        (oracle-data (map-get? oracles oracle-id))
      )
    (match oracle-data
      o
        (begin
          (asserts! (is-eq (get owner o) tx-sender) (err ERR-NOT-AUTHORIZED))
          (let (
                (reward (get reward-balance o))
              )
            (asserts! (> reward u0) (err ERR-INVALID_UPDATE_PARAM))
            (try! (as-contract (stx-transfer? reward tx-sender tx-sender)))
            (map-set oracles oracle-id
              (merge o {reward-balance: u0})
            )
            (print { event: "reward-claimed", id: oracle-id, amount: reward })
            (ok reward)
          )
        )
      (err ERR-ORACLE-NOT-FOUND)
    )
  )
)

(define-public (update-oracle
  (oracle-id uint)
  (new-location (string-utf8 100))
  (new-currency (string-utf8 20))
  )
  (let ((oracle (map-get? oracles oracle-id)))
    (match oracle
      o
        (begin
          (asserts! (is-eq (get owner o) tx-sender) (err ERR-NOT-AUTHORIZED))
          (try! (validate-location new-location))
          (try! (validate-currency new-currency))
          (map-set oracles oracle-id
            (merge o {
              location: new-location,
              currency: new-currency,
              timestamp: block-height
            })
          )
          (print { event: "oracle-updated", id: oracle-id })
          (ok true)
        )
      (err ERR-ORACLE-NOT-FOUND)
    )
  )
)

(define-public (get-oracle-count)
  (ok (var-get next-oracle-id))
)

(define-public (validate-proof
  (data-hash (buff 32))
  (nonce uint)
  (proof (buff 32))
  )
  (let (
        (proof-entry (map-get? proofs {data-hash: data-hash, nonce: nonce}))
      )
    (match proof-entry
      p
        (begin
          (asserts! (get consensus-reached p) (err ERR-INVALID_CONSENSUS))
          (asserts! (is-eq (get proof p) proof) (err ERR-INVALID_PROOF))
          (ok true)
        )
      (err ERR_PROOF_EXPIRED)
    )
  )
)

(define-private (award-reward (oracle-id uint) (amount uint))
  (let (
        (oracle (map-get? oracles oracle-id))
      )
    (match oracle
      o
        (map-set oracles oracle-id
          (merge o {reward-balance: (+ (get reward-balance o) amount)})
        )
      (ok false)
    )
  )
)