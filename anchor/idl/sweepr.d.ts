export type Sweepr = {
  address: string;
  metadata: {
    name: "sweepr";
    version: "0.1.0";
    spec: "0.1.0";
  };
  instructions: [
    {
      name: "initializePool";
      accounts: [
        { name: "pool"; writable: true },
        { name: "escrow"; writable: true },
        { name: "payer"; writable: true; signer: true },
        { name: "systemProgram"; address: "11111111111111111111111111111111" },
      ];
      args: [
        { name: "poolId"; type: { array: ["u8", 16] } },
        { name: "entryFee"; type: "u64" },
      ];
    },
    {
      name: "updateScore";
      accounts: [
        { name: "pool"; writable: true },
        { name: "member"; writable: true },
        { name: "oracle"; signer: true },
      ];
      args: [
        { name: "points"; type: "u64" },
        { name: "nonce"; type: "string" },
      ];
    },
    {
      name: "settlePool";
      accounts: [
        { name: "pool"; writable: true },
        { name: "escrow"; writable: true },
        { name: "winner"; writable: true },
        { name: "oracle"; signer: true },
        { name: "protocolFeeWallet"; writable: true },
        { name: "tokenProgram"; address: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb" },
      ];
      args: [];
    },
  ];
};
